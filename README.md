# EpicFoundry

EpicFoundry is an MIT-licensed, open-source NestJS framework that turns product epics into executable development workflows.

Pipeline:

`Epic -> Tasks -> Code -> Tests`

## What V1 does

- Reads Epic cards from Trello (cards that start with `EPIC:`)
- Parses Epic descriptions into structured data
- Generates default implementation tasks from each epic
- Runs a worker loop that processes Trello tasks from `Todo`
- Moves cards through `In Progress`, then to `Review` or `Failed`

## Architecture

`src/`

- `config/`: environment loading via `dotenv`
- `models/`: core domain types (`Epic`, `Task`)
- `parser/`: Epic and task parsers
- `trello/`: Trello API integration with `axios`
- `planner/`: Epic -> Tasks conversion
- `worker/`: task execution simulation and card transitions
- `common/logger/`: lightweight app logger utility

## Trello configuration

Create a `.env` file in the project root:

```env
TRELLO_API_KEY=your_api_key
TRELLO_TOKEN=your_token
TRELLO_BOARD_ID=your_board_id
```

Expected Trello list names:

- `Todo`
- `In Progress`
- `Review`
- `Failed`

## Epic format

Card title:

```text
EPIC: User profile editing
```

Card description:

```text
Goal:
Users can edit their profile.

Scope:
- edit name
- edit email

Acceptance:
- changes persist
- email validated
```

## Example generated tasks

From `EPIC: User profile editing`, planner generates:

- `User profile editing - API contract`
- `User profile editing - Backend endpoint`
- `User profile editing - Frontend form`
- `User profile editing - E2E verification`

## CLI commands

```bash
npm run sync:epics
npm run plan:tasks
npm run run:worker
```

- `sync:epics`: fetches and parses epic cards from Trello
- `plan:tasks`: fetches epics and prints generated tasks
- `run:worker`: processes cards in `Todo` and moves them through workflow lists

## Run project

```bash
npm install
npm run start:dev
```

## License

MIT
