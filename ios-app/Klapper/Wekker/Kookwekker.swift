import ActivityKit
import Foundation
import Observation

/// De kookwekkers, buiten de app.
///
/// Koken is niet naar je telefoon kijken. Je zet de pan op en je loopt weg, en
/// een timer die alleen bestaat zolang het scherm aanstaat is dan geen timer.
/// Vandaar ActivityKit: het aftellen komt op het vergrendelscherm en in het
/// eiland te staan, en blijft daar staan als de app allang in de achtergrond
/// hangt.
///
/// **Het aftellen doet de widget zelf.** Die tekent `Text(timerInterval:)`, en
/// die houdt zijn eigen klok bij. Deze klasse raakt een wekker maar op vier
/// momenten aan: zetten, pauzeren, hervatten en weghalen. Elke seconde
/// `update()` aanroepen is geen optie — er zit een budget op de updates van een
/// Live Activity, en eroverheen gaan betekent dat de wekker halverwege bevriest
/// op een getal dat niet meer klopt. Dat is erger dan geen wekker.
///
/// ## Waar dit aan hangt
///
/// Nog nergens. De native app heeft nog geen kookscherm (`Schermen/` bevat
/// aanmelden en het overzicht), dus er is nog geen knop die dit aanroept — de
/// kookmodus met de timers staat op dit moment alleen op het web, in
/// `src/components/CookMode.tsx`. Deze laag staat er wél helemaal, zodat dat
/// kookscherm straks aan één regel per knop genoeg heeft:
///
/// ```swift
/// Kookwekker.gedeeld.start(
///     gerecht: recept.titel, receptId: recept.id,
///     stap: index + 1, vanTotaal: recept.stappen.count,
///     stapTitel: stap.kort, minuten: stap.timerMinuten
/// )
/// ```
@MainActor
@Observable
final class Kookwekker {
    static let gedeeld = Kookwekker()

    /// Een afgegane wekker die niemand wegdrukte halen we hierna weg. Lang
    /// genoeg dat je 'm nog ziet als je terugkomt uit de tuin, kort genoeg dat
    /// je vergrendelscherm morgen niet vol staat met gisteren.
    private static let opruimenNa: TimeInterval = 30 * 60

    /// Wat er loopt, op sleutel `receptId#stap`. Alleen om de wekker terug te
    /// vinden; de waarheid staat bij ActivityKit, niet hier.
    private var lopend: [String: Activity<KookwekkerAttributes>] = [:]

    /// Hoeveel wekkers deze app op dit moment heeft staan. Voor een scherm dat
    /// wil laten zien dat er nog iets op het vuur staat.
    private(set) var aantal = 0

    /// Mag het? De gebruiker kan Live Activities per app uitzetten, en een
    /// toestel zonder eiland heeft ze nog steeds op het vergrendelscherm.
    ///
    /// Vraag dit vlak vóór het aanzetten en niet één keer bij het opstarten:
    /// de schakelaar zit in Instellingen en die kan iemand tussendoor omzetten.
    var beschikbaar: Bool {
        ActivityAuthorizationInfo().areActivitiesEnabled
    }

    private init() {}

    // MARK: - Zetten en weghalen

    /// Een wekker zetten. Loopt er al een voor deze stap, dan wordt die
    /// vervangen — twee wekkers voor dezelfde pan is nooit wat je bedoelde.
    func start(
        gerecht: String,
        receptId: String,
        stap: Int,
        vanTotaal: Int,
        stapTitel: String,
        minuten: Int
    ) {
        guard minuten > 0, beschikbaar else { return }
        stop(receptId: receptId, stap: stap)

        let nu = Date()
        let attributen = KookwekkerAttributes(
            gerecht: gerecht,
            receptId: receptId,
            stap: stap,
            vanTotaal: vanTotaal,
            stapTitel: stapTitel
        )
        let stand = KookwekkerAttributes.ContentState(
            gestartOp: nu,
            eindigtOp: nu.addingTimeInterval(TimeInterval(minuten) * 60),
            restSeconden: minuten * 60,
            gepauzeerd: false
        )

        do {
            let wekker = try Activity<KookwekkerAttributes>.request(
                attributes: attributen,
                content: inhoud(stand),
                // Geen pushType: alles gebeurt op het toestel. Wekkers over de
                // server laten lopen zou betekenen dat de keukentimer stilstaat
                // als de wifi hapert, en dat is de verkeerde afhankelijkheid.
                pushType: nil
            )
            lopend[sleutel(receptId, stap)] = wekker
            aantal = lopend.count
        } catch {
            // Niet erg genoeg om iets van te zeggen: de timer in de app loopt
            // gewoon door, alleen zonder vergrendelscherm.
            meld("kon de wekker niet zetten", error)
        }
    }

    /// Pauzeren. Het aftellen stopt en er komt te staan wat er nog stond.
    func pauzeer(receptId: String, stap: Int) {
        guard let wekker = lopend[sleutel(receptId, stap)] else { return }
        let stand = wekker.content.state
        guard !stand.gepauzeerd else { return }

        let rest = Int(max(0, stand.eindigtOp.timeIntervalSinceNow.rounded()))
        werkBij(
            wekker,
            .init(
                gestartOp: stand.gestartOp,
                eindigtOp: stand.eindigtOp,
                restSeconden: rest,
                gepauzeerd: true
            )
        )
    }

    /// Hervatten. Telt verder vanaf wat er stond, niet vanaf het begin.
    func hervat(receptId: String, stap: Int) {
        guard let wekker = lopend[sleutel(receptId, stap)] else { return }
        let stand = wekker.content.state
        guard stand.gepauzeerd else { return }

        let nu = Date()
        werkBij(
            wekker,
            .init(
                gestartOp: nu,
                eindigtOp: nu.addingTimeInterval(TimeInterval(max(0, stand.restSeconden))),
                restSeconden: stand.restSeconden,
                gepauzeerd: false
            )
        )
    }

    /// Weghalen. Meteen van het vergrendelscherm af: wie hem wegdrukt is klaar
    /// met die pan en wil geen kaartje dat nog een minuut blijft hangen.
    func stop(receptId: String, stap: Int) {
        guard let wekker = lopend.removeValue(forKey: sleutel(receptId, stap)) else { return }
        aantal = lopend.count
        Task { await wekker.end(nil, dismissalPolicy: .immediate) }
    }

    /// Alle wekkers van één gerecht. Dit hoort bij het verlaten van de
    /// kookmodus: je bent klaar, de pannen staan van het vuur.
    func stopAlles(van receptId: String) {
        // Eerst de sleutels apart zetten. `lopend.keys` is een venster op de
        // dictionary zelf, en daar tijdens het lopen uit verwijderen is vragen
        // om een crash die je pas ziet bij twee pannen tegelijk.
        for sleutel in Array(lopend.keys) where sleutel.hasPrefix("\(receptId)#") {
            guard let wekker = lopend.removeValue(forKey: sleutel) else { continue }
            Task { await wekker.end(nil, dismissalPolicy: .immediate) }
        }
        aantal = lopend.count
    }

    // MARK: - Na een koude start

    /// De wekkers terugvinden die de app overleefd hebben.
    ///
    /// Dit is de stap die je vergeet. Een Live Activity blijft staan als iOS de
    /// app onder je vandaan sluit, maar `lopend` is dan leeg — en dan kun je ze
    /// niet meer pauzeren of wegdrukken, want je hebt er geen greep meer op.
    /// Roep dit aan bij het opstarten en bij terugkeer naar de voorgrond.
    ///
    /// Meteen de opruimbeurt erbij: een wekker die een halfuur geleden afging
    /// heeft niemand meer nodig, en de app was er niet om hem weg te halen toen
    /// het gebeurde.
    func hervatBestaande() {
        var terug: [String: Activity<KookwekkerAttributes>] = [:]
        for wekker in Activity<KookwekkerAttributes>.activities {
            let kenmerk = wekker.attributes
            let stand = wekker.content.state
            let voorbij = !stand.gepauzeerd
                && stand.eindigtOp.addingTimeInterval(Self.opruimenNa) < Date()

            if voorbij {
                Task { await wekker.end(nil, dismissalPolicy: .immediate) }
            } else {
                terug[sleutel(kenmerk.receptId, kenmerk.stap)] = wekker
            }
        }
        lopend = terug
        aantal = lopend.count
    }

    // MARK: - Binnenwerk

    private func sleutel(_ receptId: String, _ stap: Int) -> String {
        "\(receptId)#\(stap)"
    }

    /// `staleDate` op het moment dat hij afgaat.
    ///
    /// Zo hoeven wij niets te doen als de wekker afloopt: de widget ziet zijn
    /// eigen inhoud verouderen en tekent de afgegane stand. Precies waarom er
    /// geen tik-elke-seconde nodig is. Gepauzeerd verloopt er niets, dus dan
    /// niets meegeven.
    private func inhoud(
        _ stand: KookwekkerAttributes.ContentState
    ) -> ActivityContent<KookwekkerAttributes.ContentState> {
        ActivityContent(state: stand, staleDate: stand.gepauzeerd ? nil : stand.eindigtOp)
    }

    /// Bijwerken gebeurt los van de aanroep.
    ///
    /// De knop in de kookmodus hoeft niet te wachten op ActivityKit, en de
    /// volgorde komt vanzelf goed: pauzeren en hervatten zijn dingen die een
    /// mens één voor één indrukt, niet iets dat een lus afvuurt.
    private func werkBij(
        _ wekker: Activity<KookwekkerAttributes>,
        _ stand: KookwekkerAttributes.ContentState
    ) {
        let nieuw = inhoud(stand)
        Task { await wekker.update(nieuw) }
    }

    private func meld(_ wat: String, _ fout: Error) {
        #if DEBUG
        print("⏲️ Kookwekker: \(wat) — \(fout)")
        #endif
    }
}
