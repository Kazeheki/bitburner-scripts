//! Websocket Server to remotely manage the files on your Bitburner home server.

use std::net::SocketAddr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::{process, thread};

use futures_util::{SinkExt, StreamExt};
use log::{debug, error, info};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::{Error, Message};
use tungstenite::Result;

/// Current version of the used jsonrpc.
const JSONRPC_VERSION: &str = "2.0";

/// Counter for request IDs.
static REQUEST_ID_COUNTER: AtomicUsize = AtomicUsize::new(0);

/// Possible methods for interacting with Bitburner remote API.
#[derive(Serialize, Deserialize, Debug)]
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
#[derive(Serialize, Deserialize)]
struct Request<'a> {
    /// Version of jsonrpc.
    jsonrpc: &'a str,
    /// Request ID.
    id: usize,
    /// Method that the request invokes.
    method: BitburnerMethod,
    /// Generic parameters that can be set specific to a request.
    params: Option<Map<String, Value>>,
}

impl Request<'_> {
    /// Get all names of files on the home server.
    /// Bitburner will answer with [`Response<T>`].
    fn get_file_names() -> Self {
        let mut params = Map::with_capacity(1);
        params.insert(String::from("server"), json!("home"));
        Request {
            jsonrpc: JSONRPC_VERSION,
            id: REQUEST_ID_COUNTER.fetch_add(1, Ordering::Relaxed),
            method: BitburnerMethod::GetFileNames,
            params: Some(params),
        }
    }
}

/// Response from Bitburner remote API.
#[derive(Serialize, Deserialize, Debug)]
struct Response<'a, T> {
    /// Version of jsonrpc.
    jsonrpc: &'a str,
    /// Request ID.
    id: usize,
    /// Result from the request.
    result: Option<T>,
    /// Error on executing request.
    error: Option<String>,
}

#[tokio::main]
async fn main() {
    env_logger::init();

    let addr = "127.0.0.1:18080";

    let listener = TcpListener::bind(&addr).await.expect("Cannot bind server");

    info!("Listening on {}", addr);
    info!("Waiting for connection...");

    while let Ok((stream, _)) = listener.accept().await {
        let peer = stream.peer_addr().expect("No peer address");
        info!("Peer address: {}", peer);

        tokio::spawn(accept_connection(peer, stream));
    }
}

/// Accepting websocket connections.
async fn accept_connection(peer: SocketAddr, stream: TcpStream) {
    info!("Accepting connection");

    if let Err(e) = handle_connection(peer, stream).await {
        match e {
            Error::ConnectionClosed | Error::Protocol(_) | Error::Utf8 => handle_close(),
            err => error!("Error on processing connection: {}", err),
        }
    }
}

async fn handle_connection(peer: SocketAddr, stream: TcpStream) -> Result<()> {
    let ws_stream = accept_async(stream).await.expect("Was not able to accept");
    info!("New websocket connection with {}", peer);

    let (mut outgoing, mut incoming) = ws_stream.split();

    let (method_sender, mut method_receiver) = mpsc::unbounded_channel::<BitburnerMethod>();

    let inquire_thread = thread::Builder::new()
        .spawn(move || loop {
            let options = vec!["file names", "quit"];
            let answer: Result<&str, _> =
                inquire::Select::new("What do you want to do?", options).prompt();

            match answer {
                Ok(x) if x == "file names" => {
                    method_sender.send(BitburnerMethod::GetFileNames).unwrap()
                }
                Ok(x) if x == "quit" => process::exit(0),
                _ => unreachable!("how did you get here?"),
            }
            thread::park();
        })
        .unwrap();

    tokio::spawn(async move {
        loop {
            while let Some(msg) = incoming.next().await {
                let msg = msg.unwrap();
                if msg.is_close() {
                    break;
                }
                if let tungstenite::Message::Text(msg) = msg {
                    let response: Response<Vec<String>> =
                        serde_json::from_str(msg.as_str()).unwrap();
                    if let Some(result) = response.result {
                        info!("result: {:#?}", result);
                    } else if let Some(err) = response.error {
                        error!("RPC error: {}", err);
                    }
                }
                inquire_thread.thread().unpark();
            }
        }
    });

    tokio::spawn(async move {
        while let Some(method) = method_receiver.recv().await {
            debug!("Will execute method {:?}", method);
            let request = Request::get_file_names();
            let request = serde_json::to_string(&request).unwrap();

            debug!("Sending message: {}", request);
            outgoing.send(Message::text(request)).await.unwrap();
        }
    });

    Ok(())
}

/// Clean up after the client closed the connection.
fn handle_close() {
    info!("not implemented");
}
