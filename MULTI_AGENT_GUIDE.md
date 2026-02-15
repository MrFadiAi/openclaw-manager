# Multi-Agent Telegram Setup — Multi-Bot Accounts

Route different forum topics (or groups) to different AI agents by using **separate Telegram bots**, each bound to its own agent.

---

## How It Works

```
@researchbot (Account: researchbot) ──→ Agent: research
@coderbot    (Account: coderbot)    ──→ Agent: coder
```

Each bot is a separate Telegram account in OpenClaw. You add both bots to the same group, and each responds independently with its own agent/personality/memory.

---

## Step 1: Create Bots in BotFather

1. Open Telegram → search **@BotFather**
2. Send `/newbot` → name it "Research Bot" → username: `orbex_research_bot`
3. Copy the **bot token**
4. Repeat for a second bot: "Code Bot" → `orbex_code_bot`
5. For each bot: send `/setprivacy` → select the bot → `Disable` (so it can see group messages)

---

## Step 2: Add Bot Accounts in Channels

1. Open **OpenClaw Manager** → **Channels** → **Telegram**
2. Scroll down to **Bot Accounts** section
3. Click **+ Add Bot**:
   - Account ID: `researchbot`
   - Bot Token: *(paste token from step 1)*
   - Click **Add**
4. Click **+ Add Bot** again:
   - Account ID: `coderbot`
   - Bot Token: *(paste second token)*
   - Click **Add**
5. Expand each account and set **Group Policy** → `open` (or `allowlist`)
6. Click **Save Account** on each

---

## Step 3: Create Agents

1. Go to **Agents** → **+ Add Agent**
2. Create agent `research` (Agent ID: `research`)
3. Create agent `coder` (Agent ID: `coder`)
4. Save each

---

## Step 4: Create Routing Rules

1. In **Routing Rules** → **+ Add Rule**
2. First rule:
   - **Route To Agent**: `research`
   - **Channel**: `telegram`
   - **Account ID**: `researchbot`
   - **Peer Match**: Any
   - Click **Add Rule**
3. Second rule:
   - **Route To Agent**: `coder`
   - **Channel**: `telegram`
   - **Account ID**: `coderbot`
   - **Peer Match**: Any
   - Click **Add Rule**

---

## Step 5: Add Bots to Your Group

1. Open your Telegram group
2. Add both bots as members: `@orbex_research_bot` and `@orbex_code_bot`
3. Make both bots **admins** (so they can see all messages)

---

## Step 6: Verify openclaw.json

Check `~/.openclaw/openclaw.json`:

```json
{
  "agents": {
    "list": [
      { "id": "research" },
      { "id": "coder" }
    ]
  },
  "bindings": [
    { "agentId": "research", "match": { "channel": "telegram", "accountId": "researchbot" } },
    { "agentId": "coder", "match": { "channel": "telegram", "accountId": "coderbot" } }
  ],
  "channels": {
    "telegram": {
      "accounts": {
        "researchbot": { "botToken": "TOKEN_1", "groupPolicy": "open" },
        "coderbot": { "botToken": "TOKEN_2", "groupPolicy": "open" }
      }
    }
  }
}
```

---

## Step 7: Restart & Test

1. **Restart OpenClaw**
2. In your Telegram group, send `@orbex_research_bot what are you?`
3. Then send `@orbex_code_bot what are you?`
4. Each should respond with its own personality

---

## Quick Reference

| Task | Where |
|---|---|
| Create Telegram bots | BotFather → `/newbot` |
| Add bot accounts | Channels → Telegram → Bot Accounts |
| Create agents | Agents → + Add Agent |
| Route account → agent | Agents → + Add Rule → set Account ID |
| Per-account groups | Channels → expand account → Group Policy |
