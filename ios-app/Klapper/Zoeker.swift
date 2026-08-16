import Foundation

/// Zoeken in je eigen recepten, op het toestel.
///
/// Een vertaling van `src/lib/recipe/search.ts`, met dezelfde regel erachter:
/// de belangrijkste vraag is niet "waar staat dat woord" maar **wat kan ik maken
/// met wat er in huis is**. Typ je "paprika gehakt", dan wil je eerst de
/// recepten die allebei gebruiken, en daarna die waar je nog één ding voor mist.
///
/// Dit gebeurt lokaal en niet op de server. Niet om de server te sparen, maar
/// omdat het dán ook werkt zonder bereik — en dat is de hele reden dat er een
/// kast is.
enum Zoeker {
    struct Treffer: Equatable {
        let recept: Recept
        /// Hoeveel van je termen dit recept afdekt.
        let raak: Int
        /// Welke termen in de ingrediënten zaten; dat telt zwaarder dan de titel.
        let inIngredienten: [String]
        let mist: [String]
    }

    /// "paprika gehakt" en "paprika, gehakt" leveren allebei twee termen op.
    ///
    /// Staat er een komma in, dan is die de scheiding en mag een term uit meer
    /// woorden bestaan. Zonder komma's splitst de spatie, want zo typt iedereen
    /// het als het even snel moet.
    static func termen(_ ruw: String) -> [String] {
        let scheiding: CharacterSet = ruw.contains(",") ? [",", ";", "\n"] : .whitespacesAndNewlines
        var gezien = Set<String>()
        var uit: [String] = []

        for stuk in ruw.components(separatedBy: scheiding) {
            let woord = stuk.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            guard woord.count >= 2, !gezien.contains(woord) else { continue }
            gezien.insert(woord)
            uit.append(woord)
        }
        return Array(uit.prefix(8))
    }

    static func zoek(
        in recepten: [Recept],
        termen: [String],
        moment: String?,
        dieet: String?
    ) -> [Recept] {
        let gefilterd = recepten.filter { recept in
            (moment == nil || recept.momenten.contains(moment!))
                && (dieet == nil || recept.dieet.contains(dieet!))
        }
        guard !termen.isEmpty else { return gefilterd }

        let treffers = gefilterd.compactMap { beoordeel($0, termen: termen) }

        // Alles-of-niets: recepten die al je termen afdekken staan boven de
        // streep, de rest eronder. Daarbinnen telt een treffer in de
        // ingrediënten zwaarder dan een in de titel.
        return treffers
            .sorted { links, rechts in
                if links.raak != rechts.raak { return links.raak > rechts.raak }
                if links.inIngredienten.count != rechts.inIngredienten.count {
                    return links.inIngredienten.count > rechts.inIngredienten.count
                }
                if links.recept.favoriet != rechts.recept.favoriet {
                    return links.recept.favoriet
                }
                return links.recept.toegevoegd > rechts.recept.toegevoegd
            }
            .map(\.recept)
    }

    static func beoordeel(_ recept: Recept, termen: [String]) -> Treffer? {
        let ingredientwoorden = recept.alleIngredienten.flatMap { woorden($0.naam) }
        let overigewoorden = woorden(
            [recept.titel, recept.omschrijving ?? "", recept.keuken ?? ""]
                .joined(separator: " ")
        ) + recept.tags.map { $0.lowercased() }

        var raak = 0
        var inIngredienten: [String] = []
        var mist: [String] = []

        for term in termen {
            if past(ingredientwoorden, term) {
                raak += 1
                inIngredienten.append(term)
            } else if past(overigewoorden, term) {
                raak += 1
            } else {
                mist.append(term)
            }
        }

        guard raak > 0 else { return nil }
        return Treffer(recept: recept, raak: raak, inIngredienten: inIngredienten, mist: mist)
    }

    // MARK: - Woorden

    private static func woorden(_ tekst: String) -> [String] {
        tekst.lowercased()
            .components(separatedBy: CharacterSet.letters.inverted)
            .filter { $0.count > 1 }
    }

    /// Bestaat de term uit meer woorden, dan moeten ze er allemaal in zitten —
    /// anders vindt "rode ui" ook elk recept met een gewone ui.
    private static func past(_ woorden: [String], _ term: String) -> Bool {
        let delen = term.split(separator: " ").map(String.init)
        guard !delen.isEmpty else { return false }
        return delen.allSatisfy { deel in woorden.contains { woordPast($0, deel) } }
    }

    /// Niet met een kale `contains`: dan vindt "ui" ook "br**ui**ne suiker".
    /// Wél met begin en eind van een woord, want Nederlands plakt aan elkaar:
    /// "rundergehakt" is gehakt en "paprika's" is paprika. Voor korte termen
    /// alleen een exacte treffer — daar levert meebuigen bijna altijd onzin op.
    private static func woordPast(_ woord: String, _ term: String) -> Bool {
        if woord == term { return true }
        guard term.count >= 3 else { return false }
        if woord.hasPrefix(term) { return true }
        return woord.hasSuffix(term) && woord.count - term.count >= 3
    }
}
