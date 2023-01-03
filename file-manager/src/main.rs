//! Websocket Server to remotely manage the files on your Bitburner home server.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::{process, thread};

use futures_util::{SinkExt, StreamExt};
use inquire::error::InquireResult;
use log::{debug, error, info, trace};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use tokio::fs;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::{Error, Message};
use tungstenite::Result;
use walkdir::WalkDir;

/// Current version of the used jsonrpc.
const JSONRPC_VERSION: &str = "2.0";

/// Counter for request IDs.
static REQUEST_ID_COUNTER: AtomicUsize = AtomicUsize::new(0);

type RequestMap = Arc<Mutex<HashMap<usize, (BitburnerMethod, Request)>>>;

/// Actions the user can choose from.
enum Action {
    /// Pushing all JS files to Bitburner.
    PushAllFiles,
    /// Getting the definition file.
    GetDefinitions,
    /// Get all the filenames from Bitburner.
    GetAllFileNames,
    /// Quit the application.
    Quit,
}

impl Action {
    /// Convert Action to &str.
    fn as_str(&self) -> &str {
        match self {
            Action::PushAllFiles => "push all files",
            Action::GetDefinitions => "show definitions",
            Action::GetAllFileNames => "show all filenames on home",
            Action::Quit => "quit",
        }
    }

    /// Convert InquireResult (selection) to an Action.
    fn from(result: InquireResult<&str>) -> Self {
        match result {
            Ok(s) => match s {
                "push all files" => return Action::PushAllFiles,
                "show definitions" => return Action::GetDefinitions,
                "show all filenames on home" => return Action::GetAllFileNames,
                "quit" => return Action::Quit,
                _ => panic!("Unknown Action '{}'", s),
            },
            Err(e) => panic!("Error in result: {}", e),
        }
    }
}

/// Possible methods for interacting with Bitburner remote API.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
enum BitburnerMethod {
    /// Create or update a file.
    PushFile,
    /// Read a file and it's content.
    GetFile,
    /// Delete a file.
    DeleteFile,
    /// List all file names on a server.
    GetFileNames,
    /// Get the content of all files on a server.
    GetAllFiles,
    /// Calculate the in-game ram cost of a script.
    CalculateRam,
    /// Get the definition file of the API.
    GetDefinitionFile,
}

/// Request for any method to execute on remote API.
#[derive(Serialize, Deserialize, Debug, Clone)]
struct Request {
    /// Version of jsonrpc.
    jsonrpc: String,
    /// Request ID.
    id: usize,
    /// Method that the request invokes.
    method: BitburnerMethod,
    /// Generic parameters that can be set specific to a request.
    params: Option<Map<String, Value>>,
}

impl Request {
    /// Get all names of files on the home server.
    /// Bitburner will answer with [`Response<T>`].
    fn get_file_names() -> Self {
        let mut params = Map::with_capacity(1);
        params.insert(String::from("server"), json!("home"));
        Request {
            jsonrpc: JSONRPC_VERSION.to_string(),
            id: REQUEST_ID_COUNTER.fetch_add(1, Ordering::Relaxed),
            method: BitburnerMethod::GetFileNames,
            params: Some(params),
        }
    }

    /// Get the definition file of the API.
    /// Bitburner will answer with [`Response<String>`]
    fn get_definition_file() -> Self {
        Request {
            jsonrpc: JSONRPC_VERSION.to_string(),
            id: REQUEST_ID_COUNTER.fetch_add(1, Ordering::Relaxed),
            method: BitburnerMethod::GetDefinitionFile,
            params: None,
        }
    }

    /// Push the file with the given name and content.
    /// Bitburner will answer with [`Response<String>`].
    fn push_file(name: &str, content: &str) -> Self {
        let mut params = Map::with_capacity(3);
        params.insert(String::from("server"), json!("home"));
        params.insert(String::from("filename"), json!(name));
        params.insert(String::from("content"), json!(content));

        Request {
            jsonrpc: JSONRPC_VERSION.to_string(),
            id: REQUEST_ID_COUNTER.fetch_add(1, Ordering::Relaxed),
            method: BitburnerMethod::PushFile,
            params: Some(params),
        }
    }
}

/// Response from Bitburner remote API.
#[derive(Serialize, Deserialize, Debug)]
#[serde(untagged)]
enum GenericResponse<'a> {
    StringResponse {
        /// Version of jsonrpc.
        jsonrpc: &'a str,
        /// Request ID.
        id: usize,
        /// Result from the request.
        result: Option<String>,
        /// Error on executing request.
        error: Option<String>,
    },
    VecResponse {
        /// Version of jsonrpc.
        jsonrpc: &'a str,
        /// Request ID.
        id: usize,
        /// Result from the request.
        result: Option<Vec<String>>,
        /// Error on executing request.
        error: Option<String>,
    },
}

#[tokio::main]
async fn main() {
    env_logger::init();

    let request_map = RequestMap::new(Mutex::new(HashMap::new()));

    let addr = "127.0.0.1:18080";

    let listener = TcpListener::bind(&addr).await.expect("Cannot bind server");

    info!("Listening on {}", addr);
    info!("Waiting for connection...");

    while let Ok((stream, _)) = listener.accept().await {
        let peer = stream.peer_addr().expect("No peer address");
        debug!("Peer address: {}", peer);

        tokio::spawn(accept_connection(peer, stream, request_map.clone()));
    }
}

/// Accepting websocket connections.
async fn accept_connection(peer: SocketAddr, stream: TcpStream, request_map: RequestMap) {
    trace!("Accepting connection");

    if let Err(e) = handle_connection(peer, stream, request_map).await {
        match e {
            Error::ConnectionClosed | Error::Protocol(_) | Error::Utf8 => handle_close(),
            err => error!("Error on processing connection: {}", err),
        }
    }
}

/// Setup listeners after connection is established.
async fn handle_connection(
    peer: SocketAddr,
    stream: TcpStream,
    request_map: RequestMap,
) -> Result<()> {
    let ws_stream = accept_async(stream).await.expect("Was not able to accept");
    debug!("New websocket connection with {}", peer);
    info!("Connected");

    let (mut outgoing, mut incoming) = ws_stream.split();

    let (action_sender, mut action_receiver) = mpsc::unbounded_channel::<BitburnerMethod>();

    let inquire_thread = thread::Builder::new()
        .spawn(move || loop {
            let options = vec![
                Action::GetAllFileNames,
                Action::PushAllFiles,
                Action::GetDefinitions,
                Action::Quit,
            ];
            let options: Vec<_> = options.iter().map(|o| o.as_str()).collect();
            let answer: Result<&str, _> =
                inquire::Select::new("What do you want to do?", options).prompt();
            let answer: Action = Action::from(answer);

            match answer {
                Action::GetAllFileNames => {
                    action_sender.send(BitburnerMethod::GetFileNames).unwrap()
                }
                Action::PushAllFiles => action_sender.send(BitburnerMethod::PushFile).unwrap(),
                Action::GetDefinitions => action_sender
                    .send(BitburnerMethod::GetDefinitionFile)
                    .unwrap(),
                Action::Quit => process::exit(0),
            }
            thread::park();
        })
        .unwrap();

    let local_request_map = request_map.clone();
    tokio::spawn(async move {
        loop {
            while let Some(msg) = incoming.next().await {
                let msg = msg.unwrap();
                if msg.is_close() {
                    break;
                }

                process_response(msg, &local_request_map);

                if local_request_map.lock().unwrap().len() == 0 {
                    inquire_thread.thread().unpark();
                }
            }
        }
    });

    let local_request_map = request_map.clone();
    tokio::spawn(async move {
        while let Some(method) = action_receiver.recv().await {
            debug!("Will execute method {:?}", method);

            let mut requests: Vec<Request> = vec![];

            add_requests(&mut requests, method, &local_request_map).await;

            for request in requests.iter() {
                let request_json = serde_json::to_string(&request).unwrap();

                debug!("Sending message: {}", request_json);
                outgoing.send(Message::text(request_json)).await.unwrap();
            }
        }
    });

    Ok(())
}

/// Process the answer from Bitburner.
/// The response contains the id from the request.
/// With that id, the original request from the request_map can be found.
/// This method uses that fact to have special handling on responses to
/// "PushFile" requests.
fn process_response(response: tungstenite::Message, request_map: &RequestMap) {
    if let tungstenite::Message::Text(msg) = response {
        let response: GenericResponse = serde_json::from_str(msg.as_str()).unwrap();

        match response {
            GenericResponse::VecResponse {
                result, error, id, ..
            } => {
                request_map.lock().unwrap().remove(&id);
                if let Some(content) = result {
                    info!("result:\n{}", content.join("\n"));
                }
                if let Some(error) = error {
                    error!("RPC error: {}", error);
                }
            }
            GenericResponse::StringResponse {
                result, error, id, ..
            } => {
                let (method, request) = request_map.lock().unwrap().remove(&id).unwrap();
                if let Some(content) = result {
                    if matches!(method, BitburnerMethod::PushFile) {
                        info!(
                            "filename: {}, {}",
                            request.params.unwrap()["filename"],
                            content
                        );
                    } else {
                        info!("result:\n{}", content);
                    }
                }
                if let Some(error) = error {
                    error!("RPC error: {}", error);
                }
            }
        }
    }
}

/// Add requests to the given request_map.
/// Requests are created by the type of method passed.
/// Methods like "PushFile" will create multiple requests where as
/// "GetFileNames" for example will only add one request.
async fn add_requests(
    requests: &mut Vec<Request>,
    method: BitburnerMethod,
    request_map: &RequestMap,
) {
    match method {
        BitburnerMethod::GetFileNames => {
            let request = Request::get_file_names();
            request_map
                .lock()
                .unwrap()
                .insert(request.id, (BitburnerMethod::GetFileNames, request.clone()));
            requests.push(request);
        }
        BitburnerMethod::GetDefinitionFile => {
            let request = Request::get_definition_file();
            request_map.lock().unwrap().insert(
                request.id,
                (BitburnerMethod::GetDefinitionFile, request.clone()),
            );
            requests.push(request);
        }
        BitburnerMethod::PushFile => {
            let mut files = WalkDir::new("..").into_iter();

            loop {
                let entry = match files.next() {
                    None => break,
                    Some(Err(e)) => panic!("Error while walking dir: {}", e),
                    Some(Ok(e)) => e,
                };
                if entry.file_type().is_dir()
                    && entry.file_name().to_str().unwrap().eq("file-manager")
                {
                    files.skip_current_dir();
                }
                if entry.file_type().is_file()
                    && entry.file_name().to_str().unwrap().ends_with(".js")
                {
                    let mut name = entry.path().to_str().unwrap().strip_prefix("..").unwrap();
                    let path_parts = entry.path().to_str().unwrap().split("/").count();
                    if path_parts == 2 {
                        // 2 => ../script.js
                        // >2 => ../dir/script.js
                        name = name.strip_prefix("/").unwrap();
                    }
                    debug!("entry: {:?}", entry);
                    let content = fs::read_to_string(entry.path()).await.unwrap();
                    trace!("name='{}'\ncontent:\n{}", name, content);

                    let request = Request::push_file(name, content.as_str());
                    request_map
                        .lock()
                        .unwrap()
                        .insert(request.id, (BitburnerMethod::PushFile, request.clone()));
                    requests.push(request);
                }
            }
        }
        _ => todo!("not yet implemented"),
    }
}

/// Clean up after the client closed the connection.
fn handle_close() {
    info!("not implemented");
}
