import { mockInsights } from "../../src/services/ai.mock.js";

describe("mockInsights", () => {
  test("extracts a named assignee and capitalizes the task", () => {
    const r = mockInsights("Jerry: Priya will send the report by Thursday.");
    expect(r.actionItems).toEqual([
      { task: "Send the report by Thursday", assignee: "Priya", dueDate: null },
    ]);
  });

  test("'I will' and \"I'll\" use the speaker as assignee", () => {
    const r = mockInsights("Ravi: I'll fix the login bug.\nMeena: I will book the demo room.");
    expect(r.actionItems.map((a) => a.assignee)).toEqual(["Ravi", "Meena"]);
    expect(r.actionItems[0].task).toBe("Fix the login bug");
  });

  test("handles 'needs to' phrasing", () => {
    const r = mockInsights("Jerry: Ravi needs to fix the login bug.");
    expect(r.actionItems).toHaveLength(1);
    expect(r.actionItems[0].assignee).toBe("Ravi");
  });

  test("summary uses at most the first three sentences", () => {
    const r = mockInsights("Jerry: One here. Two here. Three here. Four here.");
    expect(r.summary).toBe("One here. Two here. Three here.");
  });

  test("returns no action items when nobody commits to anything", () => {
    const r = mockInsights("Jerry: We reviewed the plan. Everything looks fine.");
    expect(r.actionItems).toEqual([]);
  });

  test("empty transcript gives a safe default", () => {
    const r = mockInsights("");
    expect(r.summary).toBe("No content to summarize.");
    expect(r.actionItems).toEqual([]);
  });
});
