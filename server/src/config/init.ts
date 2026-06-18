import "dotenv/config";
import { Hono } from "hono";
import { prettyJSON } from "hono/pretty-json";
import { cors } from "hono/cors";

import performanceMiddleware from "../middlewares/performanceMiddleware";
import authMiddleware from "../middlewares/authMiddleware";

import "../utils/logger";
import "./db";
// import "./cache";
import "./loops";

import homeRoute from "../routes/homeRoute";
import problemRoute from "../routes/problemsRoute";
import assessmentRoute from "../routes/assessmentRoute";
import submissionRoute from "../routes/submissionRoute";
import organizationRoute from "../routes/organizationRoute";
import instituteRoute from "../routes/instituteRoute";
import driveRoutes from "../routes/driveRoute";
import postingRoutes from "../routes/postingRoute";
import candidateRoute from "../routes/candidateRoute";
import walletRoute from "@/routes/walletRoute";
import placementGroupRoutes from "../routes/placementGroupsroute";
import companyProfileRoute from "../routes/companyRoute";
import meetRoutes from "../routes/meetRoutes";

import userRoute from "../routes/userRoute";
import { trackRouteHits } from "../middlewares/routeTracker";

import { Server } from "socket.io";
import { serve } from "@hono/node-server";
import { Server as HttpServer } from "http";
import logger from "../utils/logger";

const port = parseInt(process.env.PORT!);

const app = new Hono();

//  Hono Server
const server = serve({
  fetch: app.fetch,
  port: port,
});

// Socket.io
const ioServer = new Server(server as HttpServer, {
  path: "/socket.io",
  serveClient: false,
  allowEIO3: true,
  cors: {
    origin: "*",
  },
});

ioServer.on("error", (err) => {
  logger.error(err);
});


app.use(trackRouteHits());
app.use(prettyJSON());
app.use(cors());
app.use(performanceMiddleware);
app.use(authMiddleware);

app.route("/home", homeRoute);
app.route("/problems", problemRoute);
app.route("/assessments", assessmentRoute);
app.route("/submissions", submissionRoute);
app.route("/users", userRoute);

app.route("/organizations", organizationRoute);
app.route("/postings", postingRoutes);

app.route("/candidates", candidateRoute);

app.route("/institutes", instituteRoute);
app.route("/drives", driveRoutes);
app.route("/placement-groups", placementGroupRoutes);
app.route("/companies", companyProfileRoute);

app.route("/wallet", walletRoute);

app.route("/meet", meetRoutes);

export default app;
export { ioServer };
