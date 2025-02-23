import { z } from "zod";


export const ResumeBookFilterCriteriaSchema = z.object({
    graduations: z.array(z.string()),
    majors: z.array(z.string()),
    degrees: z.array(z.string()),
});


