import { Namespace } from "socket.io";
import { decodeJwtToken } from "../../common/auth";
import { JwtPayload } from "../auth/auth-schemas";
import Models from "../../common/models";
import { randomUUID } from "crypto";
import { updatePointsAndCoins } from "../profile/profile-lib";
import Config from "../../common/config";
import { Player } from "./duels-schemas";

export default function duelsRouter(duelsNamespace: Namespace): void {
    duelsNamespace.on("connection", (socket) => {
        if (!socket) {
            return;
        }
        console.log("received conn");
        socket.on("join-room", async (data) => {
            const roomId: string | undefined = data["roomId"];
            const authentication: string | undefined = data["authentication"];

            if (!authentication) {
                socket.emit("error", { message: "missing authentication" });
                socket.disconnect(true);
                return;
            }

            let payload: JwtPayload;
            try {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                payload = decodeJwtToken(authentication);
            } catch (e) {
                socket.emit("error", { message: "Invalid or missing userID", error: e });
                socket.disconnect(true);
                return;
            }

            // if creating a room, assume you are player 1
            // if joining a room, assume you are player 2
            if (!roomId) {
                const id = randomUUID();
                // await Models.Duel.create({ roomId: id, player1Id: payload.id });
                const player1: Player = {
                    playerId: payload.id,
                    livesRemaining: 3,
                    move: "",
                    charges: 0,
                };

                const player2: Player = {
                    playerId: "",
                    livesRemaining: 3,
                    move: "",
                    charges: 0,
                };
                await Models.Duel.create({ roomId: id, player1: player1, player2: player2 });
                await socket.join(id);
                socket.emit("room_created", { roomId: id });
                console.log("created room with id", id);
            } else {
                try {
                    console.log("received join room with room id:", roomId);

                    const duel = await Models.Duel.findOne({ roomId: roomId });

                    if (!duel) {
                        socket.emit("error", { message: "Room not found" });
                        return;
                    }

                    if (duel.player2.playerId !== "") {
                        socket.emit("error", { message: "Room full" });
                    }

                    duel.player2.playerId = payload.id;
                    await duel.save();

                    await socket.join(roomId);
                    socket.emit("room_joined", { roomId: roomId });

                    // TODO: start game
                    startRound(duelsNamespace, roomId);
                } catch (e) {
                    socket.emit("error", { message: "Failed to join room", error: e });
                }
            }
        });

        socket.on("move", async (data) => {
            const roomId: string | undefined = data["roomId"];
            const authentication: string | undefined = data["authentication"];
            const move: string | undefined = data["move"];

            let payload: JwtPayload;
            try {
                payload = decodeJwtToken(authentication);
            } catch (e) {
                socket.emit("error", { message: "Invalid or missing userID", error: e });
                socket.disconnect(true);
                return;
            }

            if (!roomId) {
                socket.emit("error", { message: "Invalid or missing roomId" });
                return;
            }

            if (!move || !["charge", "shoot", "block"].includes(move)) {
                socket.emit("error", { message: "Invalid or missing move" });
                return;
            }

            try {
                const duel = await Models.Duel.findOne({ roomId: roomId });
                if (!duel) {
                    socket.emit("error", { message: "Duel not found" });
                    return;
                }

                if (payload.id === duel.player1.playerId) {
                    duel.player1.move = move;
                } else if (payload.id === duel.player2.playerId) {
                    duel.player2.move = move;
                } else {
                    socket.emit("error", { message: "Not a player in this duel" });
                    return;
                }

                await duel.save();
            } catch (e) {
                socket.emit("error", { message: "Failed to process move", error: e });
            }
        });
    });
}

function startRound(duelsNamespace: Namespace, roomId: string): void {
    const startTime = Date.now() + Config.TEN_SECONDS_IN_MILLISECONDS;
    duelsNamespace.to(roomId).emit("start_round", { deadline: startTime });

    setTimeout(async () => {
        const duel = await Models.Duel.findOne({ roomId: roomId });
        if (!duel) {
            return;
        }
        let player1Move = duel.player1.move ?? "charge";
        let player2Move = duel.player2.move ?? "charge";

        let player1Charges = duel.player1.charges;
        let player2Charges = duel.player2.charges;

        // if they do an invalid shoot, change their move to charge
        if (player1Move === "shoot" && player1Charges <= 0) {
            player1Move = "charge";
        }
        if (player2Move === "shoot" && player2Charges <= 0) {
            player2Move = "charge";
        }

        if (player1Move === "charge") {
            player1Charges++;
        }
        if (player2Move === "charge") {
            player2Charges++;
        }

        const winner = determineWinner(player1Move, player2Move);

        let player1Lives = duel.player1.livesRemaining;
        let player2Lives = duel.player2.livesRemaining;

        if (winner === "player1") {
            player2Lives--;
        }

        if (winner === "player2") {
            player1Lives--;
        }

        duel.player1.livesRemaining = player1Lives;
        duel.player2.livesRemaining = player2Lives;
        duel.player1.charges = player1Charges;
        duel.player2.charges = player2Charges;
        duel.player1.move = "";
        duel.player2.move = "";
        await duel.save();

        duelsNamespace.to(roomId).emit("round_result", {
            player1Move,
            player2Move,
            winner,
            player1Lives,
            player2Lives,
        });

        if (player1Lives <= 0 || player2Lives <= 0) {
            const winner = player1Lives > 0 ? "player1" : "player2";
            if (winner === "player1") {
                await updatePointsAndCoins(duel.player1.playerId, Config.DUELS_WINNER_REWARD);
                await updatePointsAndCoins(duel.player2.playerId, Config.DUELS_LOSER_REWARD);
            } else {
                await updatePointsAndCoins(duel.player1.playerId, Config.DUELS_LOSER_REWARD);
                await updatePointsAndCoins(duel.player2.playerId, Config.DUELS_WINNER_REWARD);
            }
            duelsNamespace.to(roomId).emit("game_over", { winner: winner });
            duelsNamespace.in(roomId).socketsLeave(roomId);
        } else {
            // Start next round
            startRound(duelsNamespace, roomId);
        }
    }, Config.TEN_SECONDS_IN_MILLISECONDS);
}

function determineWinner(player1Move: string, player2Move: string): string {
    if (player1Move === "shoot" && player2Move === "charge") {
        return "player1";
    } else if (player1Move === "charge" && player2Move === "shoot") {
        return "player2";
    }

    return "tie";
}
