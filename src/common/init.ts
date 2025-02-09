import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import mongoose from "mongoose";
import { z } from "zod";

// Adds .openapi to zod objects
extendZodWithOpenApi(z);

// Allows zero-length strings ("") with mongoose (see: https://github.com/Automattic/mongoose/issues/7150#issuecomment-441106911)
mongoose.Schema.Types.String.checkRequired((v) => typeof v !== "undefined");
