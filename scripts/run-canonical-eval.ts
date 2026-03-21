import { evaluateVersion } from "../mcp-servers/contract-eval-mcp/src/engine.js";

const version = process.argv[2] ?? process.env.EVAL_VERSION ?? "v1.3";
const result = evaluateVersion(version);

console.log(JSON.stringify({
	version: result.version,
	total_cases: result.total_cases,
	passed: result.passed,
	accuracy: result.accuracy,
	quality_gate: result.quality_gate,
	judge_scores: result.judge_scores,
}, null, 2));

if (result.quality_gate !== "PASS") {
	process.exitCode = 1;
}