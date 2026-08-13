//
//  Geheimen.swift
//  Klapper Delen
//
//  Kopieer dit bestand naar `Geheimen.swift` (zonder `.voorbeeld`) en vul het
//  in. Dat bestand staat in .gitignore en hoort daar te blijven.
//
//  Waarom een bestand met het token erin, en niet iets slimmers: dit is een
//  app voor twee mensen die alleen via TestFlight op jullie eigen telefoons
//  komt. Het token zit dan in de app op jullie toestellen, en dat is precies
//  waar hij hoort. Wil je hem er ooit uit hebben — bijvoorbeeld omdat je de
//  app breder verspreidt — zet hem dan in de Keychain met een App Group; zie
//  README.md onderaan.
//

import Foundation

enum Geheimen {

  /// Het adres van je server, zonder afsluitende slash.
  /// Moet met https:// beginnen: iOS weigert gewoon http.
  static let serverUrl = "https://klapper.jouw-tailnet.ts.net"

  /// Hetzelfde token als `INGEST_TOKEN` in de `.env` op de server.
  /// Minimaal 16 tekens, anders weigert de server álles.
  static let ingestToken = "vul-hier-hetzelfde-token-in-als-in-je-env"

  /// Wie de app gebruiken. Dezelfde namen als `APP_USERS` in de `.env`,
  /// in dezelfde volgorde — dan kloppen de kleuren van de rondjes ook.
  /// Eén naam of geen namen: dan laat het deelvenster de keuze weg.
  static let namen = ["Chris", "Sanne"]

  // MARK: - Onthouden wie er het laatst deelde

  private static let sleutel = "laatsteNaam"

  /// Wie de vorige keer deelde. De extensie heeft zijn eigen opslag, dus dit
  /// overleeft het sluiten van het venster maar reist niet naar de hoofd-app.
  static var laatsteNaam: String? {
    get { UserDefaults.standard.string(forKey: sleutel) }
    set { UserDefaults.standard.set(newValue, forKey: sleutel) }
  }
}
