# ZalogHub

Full-stack service that aggregates loan and collateral offers from Telegram channels into one searchable interface.

The parser monitored **12 Telegram channels** and processed approximately **50–100 offers per day**. Its main value is not the single-page UI, but the data pipeline that receives posts in different formats, normalizes them and calculates comparable deal metrics.

## Main features

- monitoring of new posts across multiple Telegram channels;
- extraction of structured fields from heterogeneous messages;
- normalization and validation of offers;
- LTV and other deal calculations;
- storage of processed offers in PostgreSQL;
- filtering and search in a single-page React interface;
- rescoring of previously imported deals;
- import of supporting reference data such as cities.

## Data flow

```text
Telegram channels
       │
       ▼
Telegram parser
       │ raw messages
       ▼
Normalization and calculations
       │
       ▼
Node.js API ──> PostgreSQL
       │
       ▼
React filtering interface
```

## Tech stack

**Frontend:** React, TypeScript, Vite, React Router, Axios, Tailwind CSS  
**Backend:** Node.js, Express, TypeScript  
**Data:** PostgreSQL, Sequelize  
**Integration:** Telegram API

## Repository structure

| Directory | Responsibility |
| --- | --- |
| `client` | Single-page React interface for browsing and filtering offers |
| `server` | REST API, data model, import, normalization and deal calculations |
| parser module | Monitoring channels and sending new posts for processing |

## Engineering highlights

- processing messages without one stable source format;
- multi-stage transformation from raw text to a normalized deal;
- calculation of LTV and deal scoring;
- filtering over aggregated offers from independent sources;
- TypeScript on both client and server.

## Status

The technical solution is complete and remains available as a working internal tool. Public development was paused after the original business hypothesis was not pursued further.

## Author

Designed and implemented by [Daniil Chabanov](https://github.com/DanikChub).
