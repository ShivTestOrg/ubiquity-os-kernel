import { Value } from "@sinclair/typebox/value";
import { Context, Hono } from "hono";
import { Env, envSchema } from "../github/types/env";
import { env as honoEnv } from "hono/adapter";
import { handleUncaughtError } from "../kernel";
import { GitHubEventHandler } from "../github/github-event-handler";
import { EmptyStore } from "../github/utils/kv-store";
import OpenAI from "openai";

class McpServer {}

class McpProxyClient {
  private _bridgeRoutes: Hono;
  private _mcpServers: Map<string, McpServer>;

  constructor() {
    this._bridgeRoutes = new Hono();

    this._bridgeRoutes.get("/", (c) => {
      return c.text("Welcome to MCP Proxy Server");
    });

    this._bridgeRoutes.get("/buildServers", async (ctx: Context) => {
      try {
        await this._buildServers(ctx);
        return ctx.text("MCP Servers built");
      } catch (error) {
        return handleUncaughtError(ctx, error);
      }
    });

    this._mcpServers = new Map();
  }

  private async _buildServers(ctx: Context) {
    const env = Value.Decode(envSchema, Value.Default(envSchema, honoEnv(ctx))) as Env;
    const request = ctx.req;
    const body = await request.json();
    const { owner, repo, command, installationId } = body;

    const llmClient = new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: env.OPENROUTER_BASE_URL,
    });

    const eventHandler = new GitHubEventHandler({
      environment: env.ENVIRONMENT,
      webhookSecret: env.APP_WEBHOOK_SECRET,
      appId: env.APP_ID,
      privateKey: env.APP_PRIVATE_KEY,
      pluginChainState: new EmptyStore(ctx.var.logger),
      llmClient,
      llm: env.OPENROUTER_MODEL,
      logger: ctx.var.logger,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const octokit = eventHandler.getAuthenticatedOctokit(installationId);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const serverKey = `${owner}/${repo}/${command}`;

    // build mcp server from the manifest
    // create webhook calls, to github action based plugins and other plugins
    // cache the serverKey and the mcpServer
    // plugins (modify the plugin sdk to call command on mcp call, with mock context(issue_comment.created))
  }

  async start() {
    const port = 3000;
    console.log(`MCP Proxy Server is running on http://localhost:${port}`);
  }

  exportRoutes() {
    return this._bridgeRoutes;
  }
}

export { McpProxyClient };
