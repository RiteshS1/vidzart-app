import { describe, expect, it } from "vitest";
import { fitCuesToDuration, parseSubtitles, SubtitleParseError } from "./parse";

let n = 0;
const id = () => `c${++n}`;

describe("parseSubtitles", () => {
  it("reads SRT with CRLF, a BOM, indexes and multi-line cues", () => {
    const srt =
      "﻿1\r\n00:00:01,000 --> 00:00:03,500\r\nHello <i>there</i>,\r\nfriend.\r\n\r\n2\r\n00:01:02,250 --> 00:01:04,000\r\nSecond cue\r\n";
    expect(parseSubtitles(srt, id).map((c) => [c.start, c.end, c.text])).toEqual([
      [1000, 3500, "Hello there, friend."],
      [62_250, 64_000, "Second cue"],
    ]);
  });

  it("reads WebVTT: header, notes, ids, short times, positioning and tags", () => {
    const vtt = `WEBVTT - demo

NOTE this is a comment
--> not a cue

intro
00:01.500 --> 00:03.000 align:start position:0%
<v Ritesh>{\\an8}Welcome &amp; hi

01:00:00.000 --> 01:00:01.000
An hour in`;
    const cues = parseSubtitles(vtt, id);
    expect(cues.map((c) => [c.start, c.end, c.text])).toEqual([
      [1500, 3000, "Welcome & hi"],
      [3_600_000, 3_601_000, "An hour in"],
    ]);
  });

  it("sorts, drops empty or backwards cues and trims overlaps", () => {
    const srt = `2
00:00:05,000 --> 00:00:09,000
Later

1
00:00:00,000 --> 00:00:06,000
Earlier, overlaps the next

3
00:00:10,000 --> 00:00:09,000
Backwards

4
00:00:11,000 --> 00:00:12,000
`;
    const cues = parseSubtitles(srt, id);
    expect(cues.map((c) => [c.start, c.end, c.text])).toEqual([
      [0, 5000, "Earlier, overlaps the next"],
      [5000, 9000, "Later"],
    ]);
  });

  it("explains when there's nothing to read", () => {
    expect(() => parseSubtitles("just some text")).toThrow(SubtitleParseError);
  });

  it("fits cues to the video's length", () => {
    const cues = parseSubtitles("1\n00:00:01,000 --> 00:00:05,000\nA\n\n2\n00:00:20,000 --> 00:00:21,000\nB", id);
    expect(fitCuesToDuration(cues, 4000).map((c) => [c.start, c.end])).toEqual([[1000, 4000]]);
  });
});
