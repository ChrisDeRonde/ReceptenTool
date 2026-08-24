import Foundation

/// De vorm waarin `/api/v1` dingen teruggeeft.
///
/// Dit is de Swift-helft van het contract; de andere helft staat in
/// `src/lib/api/vorm.ts` en wordt daar getest. Verandert er iets aan de ene
/// kant, dan hoort het aan de andere kant mee te veranderen — dat is de prijs
/// van een eigen contract, en de reden dat het er is: de database en de
/// modeluitvoer mogen dan schuiven zonder dat er een telefoon stukgaat.
///
/// Alles is `Sendable` en `Codable`, want het reist over het net én tussen
/// actors door.

// MARK: - Aanmelden

struct Aanmelding: Codable, Sendable {
    let token: String
    let vervalt: Date
    let versie: Int
}

// MARK: - De stand van zaken

/// Wat er op de server is en hoe oud het is — het hele synchronisatiemechanisme.
struct Stand: Codable, Sendable {
    let versie: Int
    let nu: Date
    let recepten: [Stempel]
    let instellingen: Instellingen
    let inbox: Inbox

    struct Stempel: Codable, Sendable, Hashable {
        let id: String
        let bijgewerkt: Date
    }

    struct Inbox: Codable, Sendable {
        let open: Int
    }
}

struct Instellingen: Codable, Sendable {
    let huishouden: Int
    let personen: [String]
    let voorkeuren: [String: Voorkeur]

    struct Voorkeur: Codable, Sendable {
        let dieet: [String]
        let afkeer: [String]
        /// Staat het zwangerschapsvinkje aan. Zie `src/lib/zwanger.ts`; de app
        /// toont er nog niets mee, maar het hoort in het contract omdat de
        /// server het meestuurt.
        let zwanger: Bool
    }

    static let leeg = Instellingen(huishouden: 2, personen: [], voorkeuren: [:])
}

// MARK: - Recepten

struct Recept: Codable, Sendable, Identifiable, Hashable {
    let id: String
    let titel: String
    let foto: String?
    let favoriet: Bool
    let totaalMinuten: Int?
    let keuken: String?
    let momenten: [String]
    let dieet: [String]
    let tags: [String]
    let cijfer: Double?
    let bijgewerkt: Date

    let omschrijving: String?
    let bron: Bron?
    let porties: Int?
    let voorbereidenMinuten: Int?
    let bereidenMinuten: Int?
    let ingredientgroepen: [Ingredientgroep]
    let stappen: [Stap]
    let tips: [String]
    let aannames: [String]
    let kooklog: [Kooklogregel]
    let toegevoegd: Date
    let bewerkt: Bewerking?

    struct Bron: Codable, Sendable, Hashable {
        let url: String?
        let naam: String?
    }

    struct Bewerking: Codable, Sendable, Hashable {
        let op: Date
        let door: String?
    }

    /// De groepen achter elkaar tot één lijst — dit is de nummering waar
    /// `Stap.ingredienten` naar verwijst. Houd beide kanten gelijk, net als in
    /// `flattenIngredients` op de server.
    var alleIngredienten: [Ingredient] {
        ingredientgroepen.flatMap(\.items)
    }

    func ingredienten(voor stap: Stap) -> [Ingredient] {
        let alles = alleIngredienten
        return Set(stap.ingredienten)
            .filter { $0 >= 0 && $0 < alles.count }
            .sorted()
            .map { alles[$0] }
    }
}

struct Ingredientgroep: Codable, Sendable, Hashable {
    let naam: String?
    let items: [Ingredient]
}

struct Ingredient: Codable, Sendable, Hashable {
    let aantal: Double?
    let eenheid: String?
    let naam: String
    let notitie: String?
}

struct Stap: Codable, Sendable, Hashable, Identifiable {
    let titel: String?
    let tekst: String
    let ingredienten: [Int]
    let timerMinuten: Int?
    let tip: String?

    /// Stappen hebben geen eigen id op de server; hun plek ín het recept ís hun
    /// identiteit. Die kennen we hier niet, dus de tekst doet dienst — twee
    /// identieke stappen in één recept komen niet voor.
    var id: String { tekst }
}

struct Kooklogregel: Codable, Sendable, Hashable, Identifiable {
    let id: String
    /// Een dag, geen tijdstip: "2026-08-16". Zie `dagAlsTekst` op de server.
    let gemaaktOp: String
    let sterren: Int?
    let notitie: String?
    let vaker: Bool?
    let wie: String?
}

struct Receptenbundel: Codable, Sendable {
    let recepten: [Recept]
    /// Id's die op de server in een oudere vorm staan. Niet nog eens proberen.
    let onleesbaar: [String]
}

// MARK: - Weekmenu en boodschappen

struct Weekmenu: Codable, Sendable {
    let week: String
    let huishouden: Int
    let regels: [Regel]

    struct Regel: Codable, Sendable, Identifiable, Hashable {
        let id: String
        let dag: String
        let receptId: String
        let titel: String
        let porties: Int?
    }
}

struct Boodschappen: Codable, Sendable {
    let week: String
    let aantal: Int
    let gerechten: Int
    let groepen: [Groep]

    struct Groep: Codable, Sendable, Identifiable, Hashable {
        let gangpad: String
        let kop: String
        let regels: [Regel]

        var id: String { gangpad }
    }

    struct Regel: Codable, Sendable, Hashable, Identifiable {
        let naam: String
        let hoeveelheid: String
        let voor: [String]

        var id: String { naam + hoeveelheid }
    }
}

// MARK: - Fouten

/// Wat de server terugstuurt als er iets niet mag of niet kan.
struct Serverfout: Codable, Sendable {
    let fout: String
    let uitleg: String?
}
