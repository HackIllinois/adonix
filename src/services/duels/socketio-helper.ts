import { Server } from "socket.io";
import { Server as HTTPServer } from "http";

let io: Server;

export function initSocket(server: HTTPServer): Server {
    io = new Server(server); // Initialize the Socket.IO server
    return io;
}

export function getSocket(): Server {
    if (!io) {
        throw new Error("Socket.io has not been initialized. Call initSocket() first.");
    }
    return io;
}
