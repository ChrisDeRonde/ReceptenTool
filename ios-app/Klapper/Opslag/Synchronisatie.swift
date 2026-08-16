import Foundation

/// Wat er moet gebeuren om de kast gelijk te trekken met de server.
///
/// Losgetrokken van het netwerk en van de opslag, want dit is het enige stuk
/// waar echt over na te denken valt, en dan wil je het kunnen testen zonder
/// server. Rij in, plan uit.
struct Plan: Equatable, Sendable {
    /// Recepten die we nog niet hebben, of die daar nieuwer zijn.
    var ophalen: [String] = []
    /// Recepten die we wél hebben maar die daar niet meer staan.
    var wegdoen: [String] = []

    var isLeeg: Bool { ophalen.isEmpty && wegdoen.isEmpty }
}

enum Synchronisatie {
    /// Vergelijk wat er lokaal staat met wat de server meldt.
    ///
    /// Drie gevallen tegelijk uit één lijst: nieuw (staat daar, niet hier),
    /// gewijzigd (staat hier ouder) en weg (staat hier, niet daar). Dat laatste
    /// is de reden dat de server de héle lijst stuurt in plaats van alleen wat
    /// er sinds gisteren veranderde: een verwijderd recept laat geen spoor na,
    /// dus een tijdstempel-vraag zou het nooit melden.
    ///
    /// Nieuwer-dan en niet gelijk-aan: loopt de klok van de server een seconde
    /// achter op wat wij bewaarden, dan haalt gelijkheid alsnog alles opnieuw op.
    static func plan(lokaal: [String: Date], server: [Stand.Stempel]) -> Plan {
        var plan = Plan()
        var gezien = Set<String>()

        for stempel in server {
            gezien.insert(stempel.id)
            guard let hier = lokaal[stempel.id] else {
                plan.ophalen.append(stempel.id)
                continue
            }
            if stempel.bijgewerkt > hier { plan.ophalen.append(stempel.id) }
        }

        plan.wegdoen = lokaal.keys.filter { !gezien.contains($0) }.sorted()
        return plan
    }
}
