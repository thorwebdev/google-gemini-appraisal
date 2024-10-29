// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import {
  prepareVirtualFile,
} from "https://deno.land/x/mock_file@v1.1.2/mod.ts";

import {
  FileMetadataResponse,
  GoogleAIFileManager,
} from "npm:@google/generative-ai/server";
import { GoogleGenerativeAI, SchemaType } from "npm:@google/generative-ai";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// JSON schema for structured output
const schema = {
  description: "List of items",
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      name: {
        type: SchemaType.STRING,
        description: "Name of the item",
        nullable: false,
      },
      description: {
        type: SchemaType.STRING,
        description: "Description of the item based on the video and audio.",
        nullable: false,
      },
      value: {
        type: SchemaType.ARRAY,
        description:
          "Estimated value of the item based on the video and audio.",
        nullable: false,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            amount: {
              type: SchemaType.NUMBER,
              description: "Value of the price",
              nullable: false,
            },
            currency: {
              type: SchemaType.STRING,
              description: "Currency of the price",
              nullable: false,
            },
          },
          required: ["amount", "currency"],
        },
      },
    },
    required: ["name", "description", "value"],
  },
};

// Initialize GoogleAIFileManager with your API_KEY.
const fileManager = new GoogleAIFileManager(
  Deno.env.get("GEMINI_API_KEY") ?? "",
);

// Initialize GoogleGenerativeAI with your API_KEY.
const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY") ?? "");

// Choose a Gemini model.
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-pro",
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: schema,
  },
});

// Check file status
const checkFileStatus = async (file: FileMetadataResponse): Promise<void> => {
  if (file.state === "PROCESSING") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // TODO: open issue: Why does file not include id?
    const newFile = await fileManager.getFile(file.name);
    console.log("newFile", newFile);
    return checkFileStatus(newFile);
  }
  return;
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const formData = await req.formData();
  const data = formData.get("file") as Blob;
  // We need to mock the file because Edge Runtime doesn't have a filesystem.
  prepareVirtualFile(
    "./webcam-recording.webm",
    new Uint8Array(await data.arrayBuffer()),
  );

  // Upload the file and specify a display name.
  const uploadResponse = await fileManager.uploadFile(
    "./webcam-recording.webm",
    {
      mimeType: "video/webm",
      displayName: "webcam-recording",
    },
  );

  console.log(uploadResponse);
  await checkFileStatus(uploadResponse.file);

  // Generate content using text and the URI reference for the uploaded file.
  const result = await model.generateContent([
    {
      fileData: {
        mimeType: uploadResponse.file.mimeType,
        fileUri: uploadResponse.file.uri,
      },
    },
    {
      text:
        "Estimate the value of the items in the video based on the visual and audio. Return the estimated value in USD, EUR, and SGD. Always provide a value, even if you have to guess. Provide a note on how confident you are in your estimate in the description.",
    },
  ]);

  // Handle the response of generated text
  const response = result.response.text();
  console.log(JSON.parse(response));

  return new Response(
    response,
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
