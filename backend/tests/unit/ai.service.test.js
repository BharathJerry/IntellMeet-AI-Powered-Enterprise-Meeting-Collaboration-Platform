import { jest } from "@jest/globals";
import { generateInsights } from "../../src/services/ai.service.js";

// A fake AI provider: replaces the global fetch for each test, so no network or API key is used.
// Nothing in src/ changes; the real fetch is restored after every test.

const reply = (content) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content } }] }),
});

const GOOD = JSON.stringify({
  summary: "The team agreed on the launch plan.",
  actionItems: [{ task: "Send the report", assignee: "Priya", dueDate: null }],
});

const ENV_KEYS = ["AI_MODE", "AI_API_KEY", "AI_BASE_URL", "AI_MODEL", "AI_JSON_MODE"];
let savedEnv;
let realFetch;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  realFetch = globalThis.fetch;
  globalThis.fetch = jest.fn();

  process.env.AI_MODE = "openai";
  process.env.AI_API_KEY = "test-key";
  process.env.AI_BASE_URL = "https://fake.test/v1";
  process.env.AI_MODEL = "test-model";
  delete process.env.AI_JSON_MODE;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  ENV_KEYS.forEach((k) => {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  });
});

const sentBody = (callIndex = 0) => JSON.parse(fetch.mock.calls[callIndex][1].body);

describe("generateInsights: mock mode", () => {
  test("never calls the provider and still returns insights", async () => {
    process.env.AI_MODE = "mock";
    const result = await generateInsights("Jerry: Priya will send the report.");
    expect(fetch).not.toHaveBeenCalled();
    expect(result.actionItems[0].assignee).toBe("Priya");
  });
});

describe("generateInsights: real provider path", () => {
  test("fails clearly when no API key is set", async () => {
    delete process.env.AI_API_KEY;
    await expect(generateInsights("hello")).rejects.toThrow("AI_API_KEY is not set");
    expect(fetch).not.toHaveBeenCalled();
  });

  test("sends the expected request and parses a valid reply", async () => {
    fetch.mockResolvedValueOnce(reply(GOOD));
    const result = await generateInsights("Jerry: Priya will send the report.");

    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("https://fake.test/v1/chat/completions");
    expect(options.headers.Authorization).toBe("Bearer test-key");
    expect(sentBody().model).toBe("test-model");
    expect(sentBody().response_format).toEqual({ type: "json_object" });
    expect(sentBody().messages[1].content).toContain("Priya will send the report");

    expect(result.summary).toBe("The team agreed on the launch plan.");
    expect(result.actionItems).toEqual([{ task: "Send the report", assignee: "Priya", dueDate: null }]);
  });

  test("AI_JSON_MODE=false leaves out response_format", async () => {
    process.env.AI_JSON_MODE = "false";
    fetch.mockResolvedValueOnce(reply(GOOD));
    await generateInsights("hello");
    expect(sentBody().response_format).toBeUndefined();
  });

  test("accepts JSON wrapped in markdown code fences", async () => {
    fetch.mockResolvedValueOnce(reply("```json\n" + GOOD + "\n```"));
    const result = await generateInsights("hello");
    expect(result.actionItems).toHaveLength(1);
  });

  test("missing actionItems defaults to an empty list", async () => {
    fetch.mockResolvedValueOnce(reply(JSON.stringify({ summary: "Short meeting." })));
    const result = await generateInsights("hello");
    expect(result.actionItems).toEqual([]);
  });
});

describe("generateInsights: retries and errors", () => {
  test("retries once when the model returns broken JSON", async () => {
    fetch.mockResolvedValueOnce(reply("Sure! Here is your summary: {oops")).mockResolvedValueOnce(reply(GOOD));
    const result = await generateInsights("hello");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.summary).toBe("The team agreed on the launch plan.");
  });

  test("retries once when the JSON has the wrong shape", async () => {
    fetch
      .mockResolvedValueOnce(reply(JSON.stringify({ actionItems: [] }))) // no summary
      .mockResolvedValueOnce(reply(GOOD));
    const result = await generateInsights("hello");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.summary).toBeDefined();
  });

  test("gives up after the second bad reply", async () => {
    fetch.mockResolvedValue(reply("not json at all"));
    await expect(generateInsights("hello")).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test("a provider error status is reported and not retried", async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
    await expect(generateInsights("hello")).rejects.toThrow("AI provider error 401");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("a network failure is passed on and not retried", async () => {
    fetch.mockRejectedValueOnce(new Error("network down"));
    await expect(generateInsights("hello")).rejects.toThrow("network down");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("generateInsights: long transcripts", () => {
  test("splits into 12,000-character chunks, then merges the partial results", async () => {
    fetch.mockResolvedValue(reply(GOOD));
    const result = await generateInsights("a".repeat(30000)); // 12000 + 12000 + 6000

    expect(fetch).toHaveBeenCalledTimes(4); // 3 chunks + 1 merge
    expect(sentBody(0).messages[1].content).toHaveLength(12000);
    expect(sentBody(2).messages[1].content).toHaveLength(6000);
    expect(sentBody(3).messages[1].content).toContain("Partial notes from one meeting");
    expect(result.summary).toBe("The team agreed on the launch plan.");
  });

  test("a transcript at exactly the chunk limit needs only one call", async () => {
    fetch.mockResolvedValueOnce(reply(GOOD));
    await generateInsights("a".repeat(12000));
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
