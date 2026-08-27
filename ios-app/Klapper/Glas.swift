import SwiftUI

/// Doorschijnende lagen, en de weg naar Liquid Glass.
///
/// ## Waarom hier geen `glassEffect` staat
///
/// Apple's Liquid Glass is `.glassEffect(_:in:)`, en dat is er pas vanaf iOS 26
/// en de bijbehorende SDK. Een `if #available(iOS 26, *)` helpt daar níét: die
/// bepaalt wat er op een ouder toestel *gebeurt*, maar de tak moet nog steeds
/// compileren — en met een oudere SDK bestaat die functie helemaal niet, dus
/// dan bouwt het project niet meer. Deze app staat op iOS 18 en is nog nooit
/// door een compiler geweest; daar een bouwfout bovenop leggen die niets met de
/// app te maken heeft is de verkeerde ruil.
///
/// Dus doet dit bestand wat wél overal compileert: `.ultraThinMaterial`, het
/// matglas dat er sinds iOS 15 is. Dezelfde plek, dezelfde vorm, alleen zonder
/// de lichtbreking. Bouw je met Xcode 26 en zet je de deployment op iOS 26, dan
/// is het één regel — in `ios-app/README.md` staat welke.
///
/// ## Waar het op zit
///
/// Dezelfde regel als op het web: alleen op de laag die bóven de inhoud hangt,
/// en alleen waar er ook echt iets achter langs komt. In deze app is dat de
/// tijd en het sterretje op een receptfoto. Een blok op een witte pagina heeft
/// niets om doorheen te laten zien.
extension View {
    /// Een doorschijnend vlak in de gegeven vorm.
    func glas(_ vorm: some Shape = .capsule) -> some View {
        background(.ultraThinMaterial, in: vorm)
    }
}
