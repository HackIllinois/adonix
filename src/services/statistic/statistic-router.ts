import { Router } from "express";
import specification, { Tag } from "../../middleware/specification";
import { Role } from "../auth/auth-schemas";
import { StatisticLog, StatisticLogFilterSchema, StatisticLogsSchema } from "./statistic-schemas";
import StatusCode from "status-code-enum";
import Models from "../../common/models";
import Config from "../../common/config";
import { FilterQuery } from "mongoose";

const statisticRouter = Router();

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
