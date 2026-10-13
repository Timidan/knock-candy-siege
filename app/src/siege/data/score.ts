export type ScoreRun = { kills: number; jars: number; stars: number; earlyCalls: number; seconds: number; won: boolean }
export const scoreFor = (run: ScoreRun) => Math.max(0, Math.round(run.kills * 100 + run.jars * 250 + run.stars * 1000 + run.earlyCalls * 300 + (run.won ? Math.max(0, 300 - Math.floor(run.seconds)) * 10 : 0)))
