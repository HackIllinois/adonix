import { Router } from "express";
import specification, { Tag } from "../../middleware/specification";
import { Role } from "../auth/auth-schemas";
import { StatisticLog, StatisticLogFilterSchema, StatisticLoggingStatusSchema, StatisticLogsSchema } from "./statistic-schemas";
import StatusCode from "status-code-enum";
import Models from "../../common/models";
import Config from "../../common/config";
import { FilterQuery } from "mongoose";
import { z } from "zod";
import { SuccessResponseSchema } from "../../common/schemas";
import RuntimeConfig from "../../common/runtimeConfig";

const statisticRouter = Router();

statisticRouter.get(
    "/logging/",
    specification({
        method: "get",
        path: "/statistic/logging/",
        tag: Tag.STATISTIC,
        role: Role.STAFF,
        summary: "Gets if logging is currently enabled",
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Current logging status",
                schema: StatisticLoggingStatusSchema,
            },
        },
    }),
    async (_req, res) => {
        const enabled = await RuntimeConfig.get("logStatistics");

        return res.status(StatusCode.SuccessOK).send({
            enabled,
        });
    },
);

statisticRouter.post(
    "/logging/:status/",
    specification({
        method: "post",
        path: "/statistic/logging/{status}/",
        tag: Tag.STATISTIC,
        role: Role.ADMIN,
        summary: "Enables or disables logging",
        parameters: z.object({
            status: z.enum(["enable", "disable"]),
        }),
        responses: {
            [StatusCode.SuccessOK]: {
                description: "Updated logging status",
                schema: SuccessResponseSchema,
            },
        },
    }),
    async (req, res) => {
        const enable = req.params.status === "enable";
        await RuntimeConfig.set("logStatistics", enable);

        return res.status(StatusCode.SuccessOK).send({
            success: true,
        });
    },
);

statisticRouter.get(
    "/",
    specification({
        method: "get",
        path: "/statistic/",
        tag: Tag.STATISTIC,
        role: Role.STAFF,
        summary: "Gets statistics for a specific time range",
        query: StatisticLogFilterSchema,
        responses: {
            [StatusCode.SuccessOK]: {
                description: "The logs",
                schema: StatisticLogsSchema,
            },
        },
    }),
    async (req, res) => {
        const { before, after, limit = Config.STATISTIC_LOG_FILTER_LIMIT } = req.query;

        const query: FilterQuery<StatisticLog> = {};
        if (before !== undefined) {
            query.timestamp = { ...query.timestamp, $lt: before };
        }
        if (after !== undefined) {
            query.timestamp = { ...query.timestamp, $gt: after };
        }

        const logs = await Models.StatisticLog.find(query)
            .select("-_id -events._id -decision._id -rsvp._id -shopItems._id")
            .limit(limit);

        res.status(StatusCode.SuccessOK).send(logs);
    },
);

export default statisticRouter;
