import Foundation

/// Hoeveelheden lezen, omrekenen en opschrijven.
///
/// De Swift-helft van `src/lib/recipe/format.ts` en `scale.ts`. Die twee zijn
/// op de server getest; deze vertaling is dat niet, dus hij houdt zich zo dicht
/// mogelijk aan het origineel — dezelfde drempels, dezelfde afrondingen,
/// dezelfde breuktekens. Wijkt er hier iets af, dan staat er op je telefoon een
/// ander getal dan op de website, en dat is precies het soort verschil waar je
/// pas achter komt met een weegschaal in je hand.
enum Hoeveelheid {
    /// Boven de 24 wordt het catering.
    static let hoogstePorties = 24
    static let laagstePorties = 1

    static func begrens(_ aantal: Int) -> Int {
        min(hoogstePorties, max(laagstePorties, aantal))
    }

    /// Voor hoeveel personen openen we dit recept?
    ///
    /// Jullie huishouden gaat vóór wat de bron zei. Een recept voor vier openen
    /// op vier terwijl jullie met z'n tweeën zijn betekent dat je elke keer
    /// twee keer op min tikt. Kent het recept geen porties, dan valt er niets
    /// te schalen en heeft de teller ook geen betekenis.
    static func beginporties(bron: Int?, huishouden: Int) -> Int? {
        guard let bron, bron > 0 else { return nil }
        return huishouden > 0 ? begrens(huishouden) : bron
    }

    /// "300 g", "2 teentje", "" bij een snufje zonder maat.
    static func tekst(_ item: Ingredient) -> String {
        let aantal = item.aantal.map(getal) ?? ""
        return [aantal, item.eenheid]
            .compactMap { $0 }
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }

    /// De hele regel op één lijn, voor plekken zonder kolommen.
    static func regel(_ item: Ingredient) -> String {
        let maat = tekst(item)
        let basis = maat.isEmpty ? item.naam : "\(maat) \(item.naam)"
        guard let notitie = item.notitie, !notitie.isEmpty else { return basis }
        return "\(basis), \(notitie)"
    }

    /// Halven, kwarten en derden lezen prettiger als breuk dan als 0,33.
    static func getal(_ waarde: Double) -> String {
        if waarde == waarde.rounded(), abs(waarde) < 1e9 {
            return String(Int(waarde))
        }

        let heel = floor(waarde)
        let rest = waarde - heel
        let breuken: [(Double, String)] = [
            (0.25, "¼"), (0.33, "⅓"), (0.5, "½"), (0.67, "⅔"), (0.75, "¾"),
        ]
        if let (_, teken) = breuken.first(where: { abs(rest - $0.0) < 0.02 }) {
            return heel > 0 ? "\(Int(heel))\(teken)" : teken
        }

        // Twee decimalen, nullen eraf, en een komma zoals het hoort.
        var uit = String(format: "%.2f", waarde)
        while uit.hasSuffix("0") { uit.removeLast() }
        if uit.hasSuffix(".") { uit.removeLast() }
        return uit.replacingOccurrences(of: ".", with: ",")
    }

    /// 90 → "1:30:00", 8 → "8:00". Voor de aftellende wekker.
    static func klok(_ seconden: Int) -> String {
        let veilig = max(0, seconden)
        let uren = veilig / 3600
        let minuten = (veilig % 3600) / 60
        let rest = veilig % 60
        return uren > 0
            ? String(format: "%d:%02d:%02d", uren, minuten, rest)
            : String(format: "%d:%02d", minuten, rest)
    }

    // MARK: - Afronden

    private static let lepels: Set<String> = [
        "el", "tl", "eetlepel", "theelepel", "eetlepels", "theelepels", "tbsp", "tsp",
    ]
    private static let kleineMaat: Set<String> = ["g", "gr", "gram", "grammen", "ml", "milliliter", "cc"]
    private static let groteMaat: Set<String> = ["kg", "kilo", "kilogram", "l", "liter", "dl", "cl"]

    /// Afronden op een hoeveelheid waarmee je kunt koken.
    ///
    /// 266,67 g wordt 265 g; niemand weegt nauwkeuriger dan dat, en een recept
    /// dat om 266,67 g vraagt lijkt precies terwijl het dat niet is.
    static func afgerond(_ waarde: Double, eenheid: String?) -> Double {
        guard waarde.isFinite, waarde > 0 else { return 0 }

        let stap = stapVoor(waarde, eenheid: eenheid)
        let rond = (waarde / stap).rounded() * stap
        // Nooit naar nul afronden: dan verdwijnt een ingrediënt uit het recept.
        let uit = rond > 0 ? rond : stap
        return (uit * 100).rounded() / 100
    }

    private static func stapVoor(_ waarde: Double, eenheid: String?) -> Double {
        let schoon = (eenheid ?? "").trimmingCharacters(in: .whitespaces).lowercased()

        // Lepels: kwart lepels bestaan, achtsten niet.
        if lepels.contains(schoon) { return 0.25 }
        // Kilo's en liters: op 50 g / 50 ml nauwkeurig.
        if groteMaat.contains(schoon) { return 0.05 }

        if kleineMaat.contains(schoon) {
            if waarde < 10 { return 0.5 }
            if waarde < 50 { return 1 }
            if waarde < 500 { return 5 }
            return 10
        }

        // Telbare dingen: eieren, uien, teentjes. Halven mogen, kwarten worden
        // onpraktisch — een kwart ei bestaat niet.
        return waarde < 4 ? 0.5 : 1
    }
}

extension Ingredient {
    /// Dit ingrediënt met een andere hoeveelheid, afgerond op iets kookbaars.
    func maal(_ factor: Double) -> Ingredient {
        guard let aantal, factor != 1 else { return self }
        return Ingredient(
            aantal: Hoeveelheid.afgerond(aantal * factor, eenheid: eenheid),
            eenheid: eenheid,
            naam: naam,
            notitie: notitie
        )
    }
}

extension Recept {
    /// Alleen hoeveelheden schalen mee.
    ///
    /// Tijden bewust niet: twee keer zoveel pasta kookt niet twee keer zo lang,
    /// en een oven wordt niet sneller warm van een grotere schaal. Ook de
    /// staptekst blijft ongemoeid — daar getallen in herschrijven is
    /// tekstmanipulatie waarbij je meer stukmaakt dan je oplost.
    func factor(naar doel: Int?) -> Double {
        guard let doel, let porties, porties > 0, doel != porties else { return 1 }
        return Double(doel) / Double(porties)
    }

    /// De groepen omgerekend.
    ///
    /// Een eigen functie in plaats van een omgerekend `Recept`: die struct heeft
    /// vierentwintig velden en er veranderen er twee. Elke keer alle
    /// vierentwintig overtikken is precies hoe je er per ongeluk eentje laat
    /// vallen.
    func groepen(voor doel: Int?) -> [Ingredientgroep] {
        let f = factor(naar: doel)
        guard f != 1 else { return ingredientgroepen }
        return ingredientgroepen.map {
            Ingredientgroep(naam: $0.naam, items: $0.items.map { item in item.maal(f) })
        }
    }

    func ingredienten(voor stap: Stap, porties doel: Int?) -> [Ingredient] {
        let f = factor(naar: doel)
        let lijst = ingredienten(voor: stap)
        guard f != 1 else { return lijst }
        return lijst.map { $0.maal(f) }
    }
}
