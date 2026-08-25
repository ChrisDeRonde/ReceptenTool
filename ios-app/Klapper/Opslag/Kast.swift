import Foundation

/// De recepten zoals ze op dit toestel staan.
///
/// **Bewust geen SwiftData.** De server is de waarheid; dit is een kopie ervan.
/// Voor een kopie is een objectgrafiek met relaties, migraties en een
/// contextlevenscyclus meer machinerie dan het probleem groot is — en elke
/// migratie is werk dat je alleen doet omdat je die machinerie hebt gekozen.
/// Wat het wél moet kunnen: alles teruglezen bij het opstarten, per stuk
/// bijwerken, en één keer wegschrijven zonder een half bestand achter te laten
/// als de app precies dan wordt afgeschoten.
///
/// Dus: één JSON-bestand met de recepten, atomair weggeschreven, in de map die
/// de app met de deelextensie deelt. Groeit de collectie ooit voorbij een paar
/// duizend, dan is dit het moment om alsnog naar SQLite te gaan — en dan is de
/// vorm hierboven precies wat je erin stopt.
actor Kast {
    private let map: URL
    private let bestand: URL
    private var recepten: [String: Recept] = [:]
    private var instellingen: Instellingen = .leeg
    private var geladen = false

    init(groep: String = Sleutelbos.groep) {
        let gedeeld = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: groep)
        // Zonder App Group (bijvoorbeeld in een test) valt hij terug op de
        // eigen map. Dan werkt alles, alleen deelt de extensie niet mee.
        map = gedeeld ?? URL.documentsDirectory
        bestand = map.appending(path: "kast.json")
    }

    /// Wat er in het bestand staat.
    ///
    /// De instellingen worden losjes gelezen en de recepten streng, en dat is
    /// met opzet. Komt er een veld bij in `Instellingen` — zoals `zwanger`
    /// erbij kwam — dan mislukt met een gesynthetiseerde decoder het hele
    /// blok, en gaat de complete receptenkast mee de prullenbak in voor één
    /// ontbrekende `Bool`. Dat is een dure prijs voor een schemawijziging die
    /// niets met recepten te maken heeft.
    ///
    /// Andersom is streng juist goed: verandert de vorm van een `Recept`, dan
    /// is wat er ligt echt niet meer te vertrouwen en is opnieuw ophalen de
    /// enige goede uitkomst.
    private struct Inhoud: Codable {
        var recepten: [Recept]
        var instellingen: Instellingen

        init(recepten: [Recept], instellingen: Instellingen) {
            self.recepten = recepten
            self.instellingen = instellingen
        }

        init(from decoder: Decoder) throws {
            let houder = try decoder.container(keyedBy: CodingKeys.self)
            recepten = try houder.decode([Recept].self, forKey: .recepten)
            instellingen =
                (try? houder.decode(Instellingen.self, forKey: .instellingen)) ?? .leeg
        }
    }

    func laad() {
        guard !geladen else { return }
        geladen = true

        guard let data = try? Data(contentsOf: bestand) else { return }
        guard let inhoud = try? JSONDecoder.klapper.decode(Inhoud.self, from: data) else {
            // Onleesbaar bestand: weggooien en opnieuw ophalen is beter dan de
            // app laten struikelen over een kapotte cache. Er gaat niets
            // verloren wat niet op de server staat.
            try? FileManager.default.removeItem(at: bestand)
            return
        }
        recepten = Dictionary(uniqueKeysWithValues: inhoud.recepten.map { ($0.id, $0) })
        instellingen = inhoud.instellingen
    }

    // MARK: - Lezen

    func alles() -> [Recept] {
        recepten.values.sorted {
            if $0.favoriet != $1.favoriet { return $0.favoriet }
            return $0.toegevoegd > $1.toegevoegd
        }
    }

    func recept(_ id: String) -> Recept? { recepten[id] }

    func huidigeInstellingen() -> Instellingen { instellingen }

    /// Wat we lokaal hebben, met hoe oud het is — de invoer voor de vergelijking
    /// met `/api/v1/stand`.
    func stempels() -> [String: Date] {
        recepten.mapValues(\.bijgewerkt)
    }

    // MARK: - Schrijven

    func bewaar(_ nieuwe: [Recept]) throws {
        for recept in nieuwe { recepten[recept.id] = recept }
        try schrijf()
    }

    func verwijder(_ ids: some Sequence<String>) throws {
        for id in ids { recepten.removeValue(forKey: id) }
        try schrijf()
    }

    func bewaar(_ nieuwe: Instellingen) throws {
        instellingen = nieuwe
        try schrijf()
    }

    private func schrijf() throws {
        let data = try JSONEncoder.klapper.encode(
            Inhoud(recepten: Array(recepten.values), instellingen: instellingen)
        )
        try FileManager.default.createDirectory(at: map, withIntermediateDirectories: true)
        // `.atomic`: eerst naar een tijdelijk bestand, dan hernoemen. Wordt de
        // app halverwege afgeschoten, dan staat het oude bestand er nog heel.
        try data.write(to: bestand, options: .atomic)
    }
}
