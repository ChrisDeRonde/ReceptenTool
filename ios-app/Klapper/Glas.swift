import SwiftUI

// Bestaat dit framework, dan bouwen we tegen de iOS 26-SDK of nieuwer.
//
// Swift kent geen `#if sdk(...)`, dus dit is de omweg: `canImport` kijkt naar
// wat er in de SDK zit en niet naar de deployment target. FoundationModels
// kwam in iOS 26, dus zijn aanwezigheid is het antwoord op de enige vraag die
// telt — mag ik `glassEffect` intikken zonder dat de build omvalt.
#if canImport(FoundationModels)
import FoundationModels
#endif

/// Doorschijnende lagen, en Liquid Glass zodra het kan.
///
/// ## Twee poorten, en ze doen niet hetzelfde
///
/// Liquid Glass zit achter twee sloten, en het verschil daartussen is precies
/// wat mensen erover in de war brengt:
///
///  - **De SDK** bepaalt of `glassEffect` bestáát. Die zit in Xcode, niet op de
///    telefoon. Met een oudere Xcode kun je de regel niet eens intikken; het
///    project compileert dan niet meer. Vandaar de `#if` hierboven.
///  - **De iOS-versie op het toestel** bepaalt of hij *mag draaien*. Dat is de
///    `if #available` hieronder.
///
/// Allebei nodig, en ze staan los van elkaar. Met alleen `#available` op een
/// oude Xcode gaat de build stuk; met alleen `#if` op een nieuwe Xcode gaat een
/// toestel op iOS 18 stuk. Zo staan ze er samen, en dan hoeft er niets meer
/// gewijzigd te worden: bouw je ooit met Xcode 26, dan zet dit bestand zichzelf
/// aan.
///
/// Let op wat hier **niet** staat: de deployment target hoeft níét naar 26.
/// Bouwen tegen de nieuwe SDK is genoeg, en dat kost je geen enkel toestel —
/// iOS 18 krijgt gewoon het matglas van de `else`-tak.
///
/// ## Waar het op zit
///
/// Dezelfde regel als op het web: alleen op de laag die bóven de inhoud hangt,
/// en alleen waar er ook echt iets achter langs komt. In deze app is dat de
/// tijd en het sterretje op een receptfoto. Een blok op een witte pagina heeft
/// niets om doorheen te laten zien.
///
/// Nog niet gecompileerd, net als de rest van deze map — en deze in het
/// bijzonder niet in de tak die een SDK nodig heeft die hier niet staat.
extension View {
    /// Een doorschijnend vlak in de gegeven vorm.
    ///
    /// Liquid Glass waar het kan, `.ultraThinMaterial` waar het niet kan. Dat
    /// laatste is het matglas van iOS 15 en scheelt de lichtbreking; verder
    /// staat het op dezelfde plek in dezelfde vorm, dus er verspringt niets.
    @ViewBuilder
    func glas(_ vorm: some Shape = .capsule) -> some View {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            glassEffect(.regular, in: vorm)
        } else {
            background(.ultraThinMaterial, in: vorm)
        }
        #else
        background(.ultraThinMaterial, in: vorm)
        #endif
    }
}
