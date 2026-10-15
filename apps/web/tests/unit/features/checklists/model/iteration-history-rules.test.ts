import {
  historyMetaLabel,
  historyNoReportText,
  historySignoffLabel,
  normalizeIterationHistory,
} from "../../../../../src/features/checklists/model/iteration-history-rules";

const ONE = {
  id: "it-1",
  number: 1,
  status: "delivered",
  goal: null,
  startedAt: "2026-10-02T13:36:19.000Z",
  startedBy: { id: "u-1", login: "lloyd" },
  deliveredAt: "2026-10-15T04:59:26.000Z",
  deliveredBy: { id: "u-2", login: "ana" },
  signoffRunId: "run-9",
};

const TWO = {
  id: "it-2",
  number: 2,
  status: "active",
  goal: "Loyalty points",
  startedAt: "2026-10-16T08:00:00.000Z",
  startedBy: { id: "u-1", login: "lloyd" },
  deliveredAt: null,
  deliveredBy: null,
  signoffRunId: null,
};

describe("normalizeIterationHistory", () => {
  it("reads every iteration, newest first, with who started and delivered it and its sign-off run", () => {
    const history = normalizeIterationHistory({ iterations: [ONE, TWO] });
    expect(history.map((iteration) => iteration.number)).toEqual([2, 1]);
    expect(history[1]).toMatchObject({
      id: "it-1",
      status: "delivered",
      startedAt: "2026-10-02T13:36:19.000Z",
      startedByLogin: "lloyd",
      deliveredByLogin: "ana",
      signoffRunId: "run-9",
    });
    expect(history[0]).toMatchObject({ goal: "Loyalty points", signoffRunId: null });
  });

  it("drops what is not an iteration and reads a body that is not a list as empty", () => {
    expect(normalizeIterationHistory({ iterations: [ONE, { id: "x" }, null] })).toHaveLength(1);
    expect(normalizeIterationHistory(null)).toEqual([]);
    expect(normalizeIterationHistory({ iterations: "nope" })).toEqual([]);
  });
});

describe("the History sentences", () => {
  const [two, one] = normalizeIterationHistory({ iterations: [ONE, TWO] });

  it("says when and by whom an iteration was delivered, and when it started", () => {
    expect(historyMetaLabel(one!, "en-GB")).toBe("Delivered 15 Oct 2026 by @ana · started 2 Oct 2026");
    expect(historyMetaLabel(two!, "en-GB")).toBe("In progress · started 16 Oct 2026");
  });

  it("points the active iteration to Checklists, and names a delivery without a sign-off", () => {
    expect(historyNoReportText(two!)).toBe(
      "This iteration is in progress. Its requirements and QA run are on the Checklists tab.",
    );
    expect(historyNoReportText(one!)).toBeNull();
    expect(historyNoReportText({ status: "delivered", signoffRunId: null })).toBe(
      "No QA sign-off was recorded for this iteration.",
    );
  });

  it("names who signed off and when", () => {
    expect(
      historySignoffLabel({ signedBy: { login: "ana-qa" }, signedAt: "2026-10-15T04:58:07.000Z" }, "en-GB"),
    ).toBe("Signed off by @ana-qa on 15 Oct 2026");
    expect(historySignoffLabel({ signedBy: null, signedAt: null })).toBe("Signed off");
  });
});
