# Politie Rapoarte Bot

Bot Discord pentru rapoarte politie in romana.

## Ce face

- Verifica automat toate mesajele din canalul de rapoarte `1518553389095588062`.
- Accepta doar modelul:

```text
Nume:
CNP Agent:
Functie detinuta:
Data:
Ora:
Infractiune + Amenda:
Poza cu buletin:
```

- Raspunde cu `Raport inregistrat cu succes` cand raportul este corect.
- Explica exact ce este gresit cand raportul nu respecta modelul.
- Salveaza toate rapoartele in baza de date SQLite.
- Are top, profil politist, statistici, lista baza de date si comanda staff pentru editare/stergere.
- Trimite notificari la rapoarte noi, editari si stergeri.

## Instalare

1. Instaleaza dependentele:

```powershell
npm install
```

2. Copiaza `.env.example` in `.env` si completeaza:

```powershell
Copy-Item .env.example .env
```

Ai nevoie de:

- `DISCORD_TOKEN`: tokenul botului.
- `DISCORD_CLIENT_ID`: Application ID din Discord Developer Portal.
- `GUILD_ID`: serverul Discord. Este deja setat la `1518541823788843100`.
- `REPORT_CHANNEL_ID`: canalul de rapoarte. Este deja setat la `1518553389095588062`.

3. In Discord Developer Portal activeaza pentru bot:

- Server Members Intent
- Message Content Intent

4. Inregistreaza comenzile slash:

```powershell
npm run deploy
```

5. Porneste botul:

```powershell
npm start
```

## Comenzi

- `/profil user:<user> pagina:<numar>` - arata activitatea unui politist.
- `/statistici` - arata statistici generale.
- `/top tip:<rapoarte|amenzi> perioada:<total|luna|saptamana>` - top politisti.
- `/baza user:<user> pagina:<numar>` - arata rapoartele salvate in baza de date.
- `/editare modifica raport_id:<id> camp:<camp> valoare:<text>` - modifica un raport in baza de date.
- `/editare sterge raport_id:<id> motiv:<text>` - marcheaza raportul ca sters si incearca sa stearga mesajul din Discord.

`/editare` si `/baza` sunt disponibile doar pentru rolurile staff configurate.

## Permisiuni Discord

Botul trebuie sa aiba:

- View Channel
- Send Messages
- Read Message History
- Manage Messages, pentru stergere prin `/editare sterge`
- Use Slash Commands

## Model raport corect

```text
Nume: Ion Popescu
CNP Agent: 1234567890123
Functie detinuta: Agent
Data: 13.08.2026
Ora: 20:30
Infractiune + Amenda: Viteza ilegala - 5000 lei
Poza cu buletin: atasament
```

La `Poza cu buletin:` poti pune un link direct catre poza sau poti atasa imaginea la mesaj.

La `CNP Agent:` accepta orice numar de cifre, de la una in sus.

La `Functie detinuta:` scrie gradul exact pe care il ai pe server. Diacriticele nu conteaza,
deci `Sef Politie` si `Șef Poliție` sunt amandoua acceptate.
