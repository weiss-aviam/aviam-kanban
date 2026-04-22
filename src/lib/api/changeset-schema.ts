import { z } from "zod";

// zod v4: use z.preprocess so trim+NFC normalization runs before the regex
// check. In zod v4, .transform() ends the validation chain, so normalization
// must happen as a preprocessing step to allow subsequent .regex() to see the
// normalized form (e.g. decomposed NFD "Café" must be composed to NFC first).
export const TitleSchema = z.preprocess(
  (val) => (typeof val === "string" ? val.trim().normalize("NFC") : val),
  z
    .string()
    .min(1)
    .max(80)
    .regex(
      /^[\p{L}\p{N}\p{P}\p{Zs}]+$/u,
      "title contains forbidden characters",
    ),
);

const PrioritySchema = z.enum(["high", "medium", "low"]).default("medium");

export const ChangesetSchema = z
  .object({
    board: z.object({
      name: TitleSchema,
      description: z.string().max(2000).optional(),
      groupId: z.string().uuid().optional(),
    }),
    columns: z
      .array(
        z.object({
          title: TitleSchema,
          position: z.number().int().positive(),
        }),
      )
      .min(1)
      .max(20),
    cards: z
      .array(
        z.object({
          columnRef: TitleSchema,
          title: TitleSchema,
          description: z.string().max(8000).optional(),
          priority: PrioritySchema,
          dueDate: z.string().datetime().optional(),
          subtasks: z
            .array(z.object({ title: TitleSchema }))
            .max(50)
            .optional(),
        }),
      )
      .max(200)
      .optional(),
  })
  .superRefine((data, ctx) => {
    const titles = new Set(data.columns.map((c) => c.title));
    if (titles.size !== data.columns.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["columns"],
        message: "duplicate column titles in request",
      });
    }
    if (data.cards) {
      data.cards.forEach((card, i) => {
        if (!titles.has(card.columnRef)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["cards", i, "columnRef"],
            message: `columnRef "${card.columnRef}" does not match any column title`,
          });
        }
      });
    }
  });

export type Changeset = z.infer<typeof ChangesetSchema>;
