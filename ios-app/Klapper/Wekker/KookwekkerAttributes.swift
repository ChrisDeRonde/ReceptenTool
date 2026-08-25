import ActivityKit
import Foundation

/// De vorm van een kookwekker op het vergrendelscherm.
///
/// Dit bestand hoort in **twee** targets: de app zet de wekker, de
/// widget-extensie tekent hem. Ze praten niet met elkaar — ActivityKit geeft de
/// extensie een kopie van deze waarden. Verander je hier iets, dan moeten
/// allebei opnieuw gebouwd worden, anders decodeert de extensie stilletjes een
/// oude vorm en zie je een lege wekker.
///
/// Eén wekker per lopende timer, niet één per gerecht. Dat is dezelfde keuze
/// als in de kookmodus op het web: er kunnen twee pannen tegelijk staan, en een
/// wekker die alleen de bovenste laat zien is een wekker waar je de onderste
/// mee vergeet. iOS zet ze onder elkaar op het vergrendelscherm en kiest zelf
/// welke het eiland krijgt — de eerstvolgende.
struct KookwekkerAttributes: ActivityAttributes {
    /// Wat er verandert terwijl hij loopt.
    ///
    /// Bewust klein. Het aftellen zelf staat hier *niet* in: dat tekent de
    /// widget met `Text(timerInterval:)`, die zijn eigen klok bijhoudt. Elke
    /// seconde `update()` aanroepen mag niet — daar zit een budget op, en je
    /// wekker bevriest halverwege als je eroverheen gaat.
    struct ContentState: Codable, Hashable {
        /// Wanneer hij begon te lopen. Alleen het beginpunt van het aftellen;
        /// bij hervatten schuift hij mee.
        var gestartOp: Date
        /// Wanneer hij afgaat.
        var eindigtOp: Date
        /// Wat er nog stond toen je pauzeerde. Leidend zodra `gepauzeerd`.
        var restSeconden: Int
        var gepauzeerd: Bool
    }

    /// Het gerecht, zodat je op het vergrendelscherm weet welke pan dit is.
    var gerecht: String
    /// Waar de wekker bij hoort. Nu nog niet gebruikt om ergens heen te
    /// springen; zodra er een kookscherm is, is dit de deeplink.
    var receptId: String
    /// Welke stap, geteld vanaf 1 zoals je het opleest.
    var stap: Int
    var vanTotaal: Int
    /// De stap in het kort: "laten sudderen", "in de oven".
    var stapTitel: String
}

extension KookwekkerAttributes.ContentState {
    /// Het bereik voor `Text(timerInterval:countsDown:)`.
    ///
    /// Nooit leeg of omgekeerd. Een bereik waarvan het einde vóór het begin
    /// ligt laat SwiftUI vallen over een assertie, en dat is precies wat je
    /// krijgt als een wekker van nul minuten ergens doorheen glipt.
    var venster: ClosedRange<Date> {
        gestartOp...max(eindigtOp, gestartOp.addingTimeInterval(1))
    }

    /// Wat er nog staat, als klok. Voor de gepauzeerde stand; loopt hij, dan
    /// telt de widget zelf af.
    var restTekst: String {
        let totaal = max(0, restSeconden)
        return String(format: "%d:%02d", totaal / 60, totaal % 60)
    }
}
