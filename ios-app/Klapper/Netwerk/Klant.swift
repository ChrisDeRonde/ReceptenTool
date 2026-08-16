import Foundation

/// De verbinding met je eigen server.
///
/// Eén actor, zodat het token nooit door twee taken tegelijk gelezen en
/// geschreven wordt. Geen bibliotheek eromheen: `URLSession` en `Codable` doen
/// alles wat hier nodig is, en een afhankelijkheid die je zelf in dertig regels
/// schrijft is een afhankelijkheid die je over twee jaar moet bijwerken.
actor Klant {
    enum Fout: LocalizedError {
        case geenAdres
        case nietAangemeld
        case verkeerdWachtwoord
        case teVaakGeprobeerd
        case server(status: Int, uitleg: String?)
        case onleesbaar

        var errorDescription: String? {
            switch self {
            case .geenAdres:
                "Er staat nog geen serveradres ingesteld."
            case .nietAangemeld:
                "Je bent niet meer aangemeld. Vul het wachtwoord opnieuw in."
            case .verkeerdWachtwoord:
                "Dat wachtwoord klopt niet."
            case .teVaakGeprobeerd:
                "Te veel pogingen. Probeer het over tien minuten weer."
            case let .server(status, uitleg):
                uitleg ?? "De server antwoordde met \(status)."
            case .onleesbaar:
                "Het antwoord van de server was niet te lezen."
            }
        }
    }

    private let sessie: URLSession
    private let sleutelbos: Sleutelbos
    private var basis: URL?
    private var token: String?

    init(sleutelbos: Sleutelbos = .standaard, sessie: URLSession = .gedeeld) {
        self.sleutelbos = sleutelbos
        self.sessie = sessie
        self.basis = sleutelbos.serveradres
        self.token = sleutelbos.token
    }

    var isAangemeld: Bool { token != nil && basis != nil }
    var adres: URL? { basis }

    func stelServerIn(_ url: URL) {
        basis = url
        sleutelbos.serveradres = url
    }

    /// Eén keer per toestel. Daarna leeft het token in de Keychain.
    func meldAan(wachtwoord: String) async throws {
        guard let basis else { throw Fout.geenAdres }

        var verzoek = URLRequest(url: basis.appending(path: "api/v1/aanmelden"))
        verzoek.httpMethod = "POST"
        verzoek.setValue("application/json", forHTTPHeaderField: "Content-Type")
        verzoek.httpBody = try JSONEncoder.klapper.encode(["wachtwoord": wachtwoord])

        let (data, antwoord) = try await sessie.data(for: verzoek)
        let status = (antwoord as? HTTPURLResponse)?.statusCode ?? 0

        switch status {
        case 200: break
        case 401: throw Fout.verkeerdWachtwoord
        case 429: throw Fout.teVaakGeprobeerd
        default: throw Fout.server(status: status, uitleg: uitlegUit(data))
        }

        let aanmelding = try decoder.decode(Aanmelding.self, from: data)
        token = aanmelding.token
        sleutelbos.token = aanmelding.token
    }

    func meldAf() {
        token = nil
        sleutelbos.token = nil
    }

    // MARK: - Lezen

    func stand() async throws -> Stand {
        try await haal("api/v1/stand")
    }

    /// Volledige recepten, in brokken van hooguit vijftig — dezelfde grens als
    /// de server hanteert, zodat je er nooit een 400 op krijgt.
    func recepten(ids: [String]) async throws -> Receptenbundel {
        guard !ids.isEmpty else { return Receptenbundel(recepten: [], onleesbaar: []) }

        var alles: [Recept] = []
        var onleesbaar: [String] = []
        for brok in ids.chunked(50) {
            let bundel: Receptenbundel = try await haal(
                "api/v1/recepten",
                query: [URLQueryItem(name: "ids", value: brok.joined(separator: ","))]
            )
            alles.append(contentsOf: bundel.recepten)
            onleesbaar.append(contentsOf: bundel.onleesbaar)
        }
        return Receptenbundel(recepten: alles, onleesbaar: onleesbaar)
    }

    func recept(id: String) async throws -> Recept {
        try await haal("api/v1/recepten/\(id)")
    }

    func weekmenu(week: String? = nil) async throws -> Weekmenu {
        try await haal("api/v1/weekmenu", query: week.map { [URLQueryItem(name: "week", value: $0)] } ?? [])
    }

    func boodschappen(week: String) async throws -> Boodschappen {
        try await haal("api/v1/boodschappen", query: [URLQueryItem(name: "week", value: week)])
    }

    // MARK: - Schrijven

    @discardableResult
    func noteerGemaakt(
        receptId: String,
        sterren: Int?,
        notitie: String?,
        vaker: Bool?,
        wie: String?,
        gemaaktOp: String? = nil
    ) async throws -> Kooklogregel {
        struct Invoer: Encodable {
            let receptId: String
            let sterren: Int?
            let notitie: String?
            let vaker: Bool?
            let wie: String?
            let gemaaktOp: String?
        }
        return try await stuur(
            "api/v1/kooklog",
            methode: "POST",
            body: Invoer(
                receptId: receptId, sterren: sterren, notitie: notitie,
                vaker: vaker, wie: wie, gemaaktOp: gemaaktOp
            )
        )
    }

    /// Wat er terugkomt als je een gerecht inplant.
    ///
    /// Geen `Weekmenu.Regel`: die draagt een titel en die stuurt de server hier
    /// niet mee — die weet de app al. Er een lege string in zetten zou een
    /// leugen zijn die pas opvalt als hij op het scherm staat.
    struct Ingepland: Decodable, Sendable {
        let id: String
        let dag: String
        let receptId: String
        let porties: Int?
        let week: String
    }

    @discardableResult
    func planIn(receptId: String, dag: String, porties: Int?) async throws -> Ingepland {
        struct Invoer: Encodable {
            let receptId: String
            let dag: String
            let porties: Int?
        }
        return try await stuur(
            "api/v1/weekmenu",
            methode: "POST",
            body: Invoer(receptId: receptId, dag: dag, porties: porties)
        )
    }

    func haalVanMenu(regelId: String) async throws {
        struct Weg: Decodable { let verwijderd: Int }
        let _: Weg = try await stuur("api/v1/weekmenu/\(regelId)", methode: "DELETE", body: Optioneel.geen)
    }

    // MARK: - Het gewone werk

    private func haal<T: Decodable>(_ pad: String, query: [URLQueryItem] = []) async throws -> T {
        guard let basis else { throw Fout.geenAdres }
        guard let token else { throw Fout.nietAangemeld }

        var onderdelen = URLComponents(
            url: basis.appending(path: pad),
            resolvingAgainstBaseURL: false
        )
        if !query.isEmpty { onderdelen?.queryItems = query }
        guard let url = onderdelen?.url else { throw Fout.geenAdres }

        var verzoek = URLRequest(url: url)
        verzoek.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        return try await voerUit(verzoek)
    }

    private func stuur<Body: Encodable, T: Decodable>(
        _ pad: String,
        methode: String,
        body: Body
    ) async throws -> T {
        guard let basis else { throw Fout.geenAdres }
        guard let token else { throw Fout.nietAangemeld }

        var verzoek = URLRequest(url: basis.appending(path: pad))
        verzoek.httpMethod = methode
        verzoek.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if !(body is Optioneel) {
            verzoek.setValue("application/json", forHTTPHeaderField: "Content-Type")
            verzoek.httpBody = try JSONEncoder.klapper.encode(body)
        }
        return try await voerUit(verzoek)
    }

    private func voerUit<T: Decodable>(_ verzoek: URLRequest) async throws -> T {
        let (data, antwoord) = try await sessie.data(for: verzoek)
        let status = (antwoord as? HTTPURLResponse)?.statusCode ?? 0

        if status == 401 {
            // Het wachtwoord op de server is veranderd, of het token is
            // verlopen. Weggooien, want een token dat niet meer werkt is erger
            // dan geen token: dan blijft de app het proberen.
            token = nil
            sleutelbos.token = nil
            throw Fout.nietAangemeld
        }
        guard (200..<300).contains(status) else {
            throw Fout.server(status: status, uitleg: uitlegUit(data))
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw Fout.onleesbaar
        }
    }

    private func uitlegUit(_ data: Data) -> String? {
        try? decoder.decode(Serverfout.self, from: data).uitleg
    }

    /// Zie `Codering.swift`: de kale `.iso8601` weigert de milliseconden die
    /// de server in elk tijdstempel zet.
    private let decoder = JSONDecoder.klapper
}

/// Voor verzoeken zonder body. Een `nil` als generieke waarde meegeven kan niet
/// zonder dat de aanroeper het type moet uitschrijven.
private struct Optioneel: Encodable {
    static let geen = Optioneel()
}

extension URLSession {
    /// Wachten heeft een grens: op een keukentafel wil je liever een nette
    /// melding dan een spinner die blijft draaien.
    static let gedeeld: URLSession = {
        let opzet = URLSessionConfiguration.default
        opzet.timeoutIntervalForRequest = 20
        opzet.timeoutIntervalForResource = 60
        opzet.waitsForConnectivity = false
        return URLSession(configuration: opzet)
    }()
}

extension Array {
    func chunked(_ grootte: Int) -> [[Element]] {
        guard grootte > 0 else { return [self] }
        return stride(from: 0, to: count, by: grootte).map {
            Array(self[$0..<Swift.min($0 + grootte, count)])
        }
    }
}
