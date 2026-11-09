import Constants from "expo-constants";
import type { ObstacleWatchProps } from "./ObstacleWatch";

export function canWatchHere(): boolean {
  return Constants.executionEnvironment !== "storeClient";
}

export function WatchScreen(props: ObstacleWatchProps) {
  const { ObstacleWatch } = require("./ObstacleWatch") as typeof import("./ObstacleWatch");
  return <ObstacleWatch {...props} />;
}
