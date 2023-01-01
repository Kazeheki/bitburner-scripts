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

#[derive(Serialize, Deserialize)]
struct Request {
    jsonrpc: String,
    id: u32,
    method: String,
    params: Option<Map<String, Value>>,
}

#[derive(Serialize, Deserialize, Debug)]
struct GetFilesResponse {
    jsonrpc: String,
    id: u32,
    result: Option<Vec<String>>,
    error: Option<Map<String, Value>>,
}

impl Request {
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
                    let response: GetFilesResponse = serde_json::from_str(msg.as_str()).unwrap();
                    info!("result: {:#?}", response.result.unwrap());
                }
            }
        }
    });

    tx.send(Message::text(request)).await?;

    Ok(())
}

fn handle_close() {
    info!("not implemented");
}
