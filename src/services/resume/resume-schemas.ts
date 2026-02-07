import { z } from "zod";

export const ResumeDownloadURLSchema = z
    .object({
        url: z.string().openapi({ example: "https://resume-bucket-dev.s3.us-east-2.amazonaws.com/abcd" }),
    })
    .openapi("ResumeDownloadURL");

export const ResumeUploadURLSchema = ResumeDownloadURLSchema.extend({
    fields: z.any(),
}).openapi("ResumeUploadURL", {
    example: {
        url: "https://resume-bucket-dev.s3.us-east-2.amazonaws.com/",
        fields: {
            success_action_status: "201",
            "Content-Type": "application/pdf",
            bucket: "resume-bucket-dev",
            "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
            "X-Amz-Credential": "ABCD/20241013/us-east-2/s3/aws4_request",
            "X-Amz-Date": "20241013T081251Z",
            key: "github1234.pdf",
            Policy: "eyJ==",
            "X-Amz-Signature": "bfe6f0c382",
        },
    },
});

export const BatchResumeDownloadListSchema = z.object({
    userIds: z.string().array(),
});

export const ResumeListDownloadURLSchema = z
    .object({
        urls: z.array(z.string()),
    })
    .openapi("ResumeListDownloadURL", {
        example: {
            urls: [
                "https://resume-bucket-dev.s3.us-east-2.amazonaws.com/abcd",
                "https://resume-bucket-dev.s3.us-east-2.amazonaws.com/xyzw",
            ],
        },
    });
