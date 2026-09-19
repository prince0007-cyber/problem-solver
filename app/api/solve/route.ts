import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const apiKey = process.env.OPENAI_API_KEY;

const openai = apiKey
  ? new OpenAI({
      apiKey,
    })
  : null;

function createFallbackSolution(text: string) {
  return {
    title: "Problem Solution",
    category: "General",
    summary: text,
    clarification: "",
    steps: [
      {
        text: "Review the solution and follow the recommended next action.",
        completed: false,
      },
    ],
    sources: [],
    urgent: false,
    urgentMessage: "",
    reminderSuggestion: "",
    sensitiveWarning: "",
  };
}

export async function POST(request: NextRequest) {
  try {
    if (!openai) {
      return NextResponse.json(
        {
          success: false,
          error:
            "OPENAI_API_KEY is missing. Add it to your .env.local file and restart the server.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();

    const problem =
      typeof body.problem === "string"
        ? body.problem.trim()
        : typeof body.prompt === "string"
          ? body.prompt.trim()
          : typeof body.question === "string"
            ? body.question.trim()
            : "";

    const image =
      typeof body.image === "string"
        ? body.image
        : typeof body.imageUrl === "string"
          ? body.imageUrl
          : "";

    const language =
      typeof body.languageName === "string"
        ? body.languageName
        : typeof body.language === "string"
          ? body.language
          : "English";

    if (!problem && !image) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter a problem or upload an image.",
        },
        { status: 400 }
      );
    }

    const prompt = `
You are a practical real-world problem solving assistant.

Solve the user's problem clearly and safely.

Respond in ${language}.

Use simple language that an ordinary person can understand.

Return ONLY valid JSON.

The JSON must have exactly these fields:

{
  "title": "short title",
  "category": "problem category",
  "summary": "short explanation",
  "clarification": "important clarification or empty string",
  "steps": [
    {
      "text": "action the user should take",
      "completed": false
    }
  ],
  "sources": [
    {
      "name": "source name",
      "reason": "why this source is useful"
    }
  ],
  "urgent": false,
  "urgentMessage": "",
  "reminderSuggestion": "",
  "sensitiveWarning": ""
}

Rules:
- Give practical steps.
- Do not invent official sources or URLs.
- Never ask for passwords, OTPs, API keys, bank PINs, or other secrets.
- For emergencies or dangerous situations, recommend appropriate professional or emergency help.
- Keep the answer concise and useful.

User's problem:
${problem || "The user uploaded an image. Understand the image and solve the problem shown."}
`;

    const content: Array<
      | { type: "input_text"; text: string }
      | { type: "input_image"; image_url: string; detail: "auto" }
    > = [
      {
        type: "input_text",
        text: prompt,
      },
    ];

    if (image) {
      content.push({
        type: "input_image",
        image_url: image,
        detail: "auto",
      });
    }

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content,
        },
      ],
    });

    const output = response.output_text?.trim();

    if (!output) {
      return NextResponse.json(
        {
          success: false,
          error: "The AI returned an empty response. Please try again.",
        },
        { status: 502 }
      );
    }

    let solution;

    try {
      const cleanedOutput = output
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      const parsed = JSON.parse(cleanedOutput);

      solution = {
        title:
          typeof parsed.title === "string"
            ? parsed.title
            : "Problem Solution",

        category:
          typeof parsed.category === "string"
            ? parsed.category
            : "General",

        summary:
          typeof parsed.summary === "string"
            ? parsed.summary
            : "",

        clarification:
          typeof parsed.clarification === "string"
            ? parsed.clarification
            : "",

        steps: Array.isArray(parsed.steps)
          ? parsed.steps.map((step: unknown) => {
              const item = step as Record<string, unknown>;

              return {
                text:
                  typeof item.text === "string"
                    ? item.text
                    : "Follow the recommended action.",

                completed:
                  typeof item.completed === "boolean"
                    ? item.completed
                    : false,
              };
            })
          : [],

        sources: Array.isArray(parsed.sources)
          ? parsed.sources.map((source: unknown) => {
              const item = source as Record<string, unknown>;

              return {
                name:
                  typeof item.name === "string"
                    ? item.name
                    : "Relevant source",

                reason:
                  typeof item.reason === "string"
                    ? item.reason
                    : "",
              };
            })
          : [],

        urgent:
          typeof parsed.urgent === "boolean"
            ? parsed.urgent
            : false,

        urgentMessage:
          typeof parsed.urgentMessage === "string"
            ? parsed.urgentMessage
            : "",

        reminderSuggestion:
          typeof parsed.reminderSuggestion === "string"
            ? parsed.reminderSuggestion
            : "",

        sensitiveWarning:
          typeof parsed.sensitiveWarning === "string"
            ? parsed.sensitiveWarning
            : "",
      };
    } catch {
      solution = createFallbackSolution(output);
    }

    return NextResponse.json({
      success: true,
      ...solution,
    });
  } catch (error) {
    console.error("Solve API error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unknown server error";

    return NextResponse.json(
      {
        success: false,
        error: `Unable to solve the problem: ${message}`,
      },
      { status: 500 }
    );
  }
}