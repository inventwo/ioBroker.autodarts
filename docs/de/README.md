![Logo](../../admin/autodarts.svg)
### Adapter for Autodarts Integration

## Die Adapter TABs

- [Optionen](config.md)
- [Hardware-Zuweisungen](mapping.md)
- [Tools Addon Integration](tools.md)
- [Hilfe & FAQ](faq.md)

#### ioBroker-seitig

1. nodejs 20.0 (oder neuer)
2. js-controller 6.0.11 (oder neuer)
3. Admin adapter 7.6.17 (oder neuer)
4. Simple-API-Adapter (optional für die Tools-Integration)

#### Darts-seitig

1. Autodarts Board-Client / Desktop (**vor v2** → lokaler Modus) oder Autodarts **v2** Desktop/Terminal (**Cloud-Modus**)
2. „Tools für Autodarts“ Browser-Addon (optional)

## Kurzanleitung

Eine ausführliche Beschreibung der Tabs findest du oben über die Links.

- Pro Dartboard muss eine separate Instanz angelegt werden.  
- Eine Instanz kann sich immer nur mit genau einem Board verbinden.  
- **Lokal:** IP und Port eintragen und Instanz starten.  
- **Cloud (v2):** Verbindungsmodus Cloud wählen, Autodarts-Login und Board-ID eintragen.  
- Wird der Darts-Server abgeschaltet, setzt die Instanz den Betrieb beim nächsten Start nahtlos fort.
