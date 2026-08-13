# Deploy pe Railway

Proiectul este pregatit pentru Railway cu `railway.toml`.

## Variabile necesare

Adauga in Railway -> Service -> Variables:

```text
DISCORD_TOKEN=tokenul_botului_tau
DISCORD_CLIENT_ID=id_aplicatie_bot
GUILD_ID=1518541823788843100
REPORT_CHANNEL_ID=1518553389095588062
NOTIFICATION_CHANNEL_ID=1518553389095588062
MENTION_STAFF_ON_REPORT=false
DELETE_INVALID_REPORTS=false
NODE_OPTIONS=--require ./src/railway-health.js
```

`NODE_OPTIONS` porneste endpointul `/health` cerut de `railway.toml`.

## Baza de date SQLite persistenta

Railway are storage temporar fara Volume. Pentru ca baza de date sa nu se piarda:

1. Ataseaza un Volume la service.
2. Pune mount path la:

```text
/app/data
```

3. Lasa `DATABASE_PATH` necompletat sau seteaza explicit:

```text
DATABASE_PATH=./data/politie_reports.sqlite
```

Cu mount path `/app/data`, fisierul `./data/politie_reports.sqlite` ramane persistent.

## Deploy recomandat

1. Pune proiectul pe GitHub.
2. Creeaza un Project in Railway.
3. Adauga un service din repo-ul GitHub.
4. Adauga variabilele de mai sus.
5. Ataseaza Volume la `/app/data`.
6. Dupa deploy, ruleaza o singura data:

```powershell
npm run deploy
```

Comanda inregistreaza slash commands in serverul Discord `1518541823788843100`.

## Note

- Nu urca `.env` pe GitHub.
- In Discord Developer Portal activeaza `Server Members Intent` si `Message Content Intent`.
- Botul trebuie sa aiba permisiuni pentru `View Channel`, `Send Messages`, `Read Message History`, `Use Slash Commands` si `Manage Messages`.
