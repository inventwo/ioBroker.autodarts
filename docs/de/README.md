![Logo](../../admin/autodarts.svg)
### Adapter for Autodarts Integration

## Die Adapter TABs

- [Optionen](config.md)
- [Hardware-Zuweisungen](mapping.md)
- [Tools Addon Integration](tools.md)
- [Hilfe & FAQ](faq.md)

#### ioBroker-seitig

1. nodejs 20.0 (oder neuer)
2. js-controller 6.0.0 (oder neuer)
3. Admin-Adapter 6.0.0 (oder neuer)
4. Simple-API-Adapter (optional für die Tools-Integration)

#### Darts-seitig

1. Autodarts Boardmanager (oder Autodarts-Desktop)
2. „Tools für Autodarts“ Browser-Addon (optional)

## Kurzanleitung

Eine ausführliche Beschreibung der Tabs findest du oben über die Links.

- Pro Dartboard muss eine separate Instanz angelegt werden.  
- Eine Instanz kann sich immer nur mit genau einem Board verbinden.  
- Sobald IP und Port des Boardmanagers eingetragen sind, kann die Instanz gestartet werden.  
- Wird der Darts-Server abgeschaltet, stoppt die Instanz automatisch und setzt den Betrieb beim nächsten Start des Dart-Servers nahtlos fort.
