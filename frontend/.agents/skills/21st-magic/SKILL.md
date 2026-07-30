---
name: 21st-magic
description: Search, generate, and refine React and Tailwind UI through the 21st MCP. Use for 21st.dev or Magic component discovery, UI inspiration, component generation, and logo search.
---

# 21st Magic

Use the current 21st MCP tools when available. Magic MCP is only a compatibility proxy.

## Workflow

1. Search the 21st catalog before generating a component from scratch.
2. Retrieve the selected component or generate variants matching the project's stack and design system.
3. Add source files inside the frontend project and preserve its aliases, tokens, and component conventions.
4. Validate responsive behavior, accessibility, and build output.

If the 21st MCP is not connected, direct the user to create a current API key at `https://21st.dev/mcp` and configure the HTTP endpoint `https://21st.dev/api/mcp`. Never commit the API key.

The legacy compatibility package source is located at `frontend/tools/magic-mcp`.
