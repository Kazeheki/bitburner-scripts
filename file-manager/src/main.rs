//! Websocket Server to remotely manage the files on your Bitburner home server.

use futures_util::SinkExt;
use futures_util::StreamExt;
use log::{error, info};
use serde::Deserialize;
use serde::Serialize;
use serde_json::json;
use serde_json::Map;
use serde_json::Value;
use std::net::SocketAddr;
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::{
    accept_async,
    tungstenite::{Error, Message},
};
use tungstenite::Result;

/// Request for any method to execute on remote API.
#[derive(Serialize, Deserialize)]
struct Request {
    /// Version of jsonrpc.
    jsonrpc: String,
    /// Request ID.
    id: u32,
    /// Method name.
    method: String,
    /// Generic parameters that can be set specific to a request.
    params: Option<Map<String, Value>>,
}

impl Request {
    /// Get all names of files on the home server.
    ///
    /// Bitburner will answer with [`Response<T>`].
    fn get_file_names() -> Self {
        let mut params = Map::with_capacity(1);
        params.insert(String::from("server"), json!("home"));
        Request {
            jsonrpc: String::from("2.0"),
            id: 1,
            method: String::from("getFileNames"),
            params: Some(params),
        }
    }
}

/// Response from Bitburner remote API.
#[derive(Serialize, Deserialize, Debug)]
struct Response<T> {
    /// Version of jsonrpc.
    jsonrpc: String,
    /// Request ID.
    id: u32,
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

    let (mut tx, mut rx) = ws_stream.split();

    let request = Request::get_file_names();
    let request = serde_json::to_string(&request).unwrap();

    tokio::spawn(async move {
        loop {
            while let Some(msg) = rx.next().await {
                let msg = msg.unwrap();
                if msg.is_close() {
                    break;
                }
                if let tungstenite::Message::Text(msg) = msg {
                    let response: Response<Vec<String>> = serde_json::from_str(msg.as_str()).unwrap();
                    info!("result: {:#?}", response.result.unwrap());
                }
            }
        }
    });

    tx.send(Message::text(request)).await?;

    Ok(())
}

/// Clean up after the client closed the connection.
fn handle_close() {
    info!("not implemented");
}
