import ActivityKit
import SwiftUI
import WidgetKit

/// De kookwekker zoals hij op het vergrendelscherm en in het eiland staat.
///
/// Eén regel om te onthouden: **hier wordt niet geteld.** Al het aftellen komt
/// uit `Text(timerInterval:countsDown:)`, die zijn eigen klok bijhoudt zonder
/// dat de app draait. Zou het aftellen uit `ContentState` komen, dan moest de
/// app elke seconde een update sturen, en daar zit een budget op dat je binnen
/// een paar minuten opmaakt.
///
/// Afgaan werkt op dezelfde manier. De app zet `staleDate` op het moment dat de
/// wekker afloopt; iOS zet `context.isStale` dan vanzelf aan en dit scherm
/// tekent de afgegane stand. Geen update nodig, en dus ook geen app die op dat
/// moment toevallig moet draaien.
struct KookwekkerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: KookwekkerAttributes.self) { context in
            Vergrendelscherm(context: context)
                .activityBackgroundTint(Kleur.vel)
                .activitySystemActionForegroundColor(Kleur.salie)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: afgegaan(context) ? "bell.fill" : "timer")
                        .foregroundStyle(afgegaan(context) ? Kleur.waarschuwing : Kleur.salie)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Klok(context: context, grootte: 22)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(context.attributes.stapTitel)
                            .font(Letter.tekst(15))
                            .foregroundStyle(Kleur.inkt)
                            .lineLimit(1)
                        Text(regel(context))
                            .font(Letter.tekst(13))
                            .foregroundStyle(Kleur.gedempt)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } compactLeading: {
                Image(systemName: afgegaan(context) ? "bell.fill" : "timer")
                    .foregroundStyle(afgegaan(context) ? Kleur.waarschuwing : Kleur.salie)
            } compactTrailing: {
                // Een breedte meegeven: zonder dit reserveert het eiland ruimte
                // voor het breedst denkbare getal en schuift de rest opzij.
                Klok(context: context, grootte: 14)
                    .frame(maxWidth: 44)
            } minimal: {
                Image(systemName: afgegaan(context) ? "bell.fill" : "timer")
                    .foregroundStyle(afgegaan(context) ? Kleur.waarschuwing : Kleur.salie)
            }
            .keylineTint(Kleur.salie)
        }
    }
}

/// Het kaartje op het vergrendelscherm.
///
/// Dezelfde opbouw als een blok in de app: bovenkopje, titel, en het getal waar
/// het om gaat aan de rechterkant. Wie zijn telefoon aantikt met natte handen
/// wil één ding lezen, en dat is de klok.
private struct Vergrendelscherm: View {
    let context: ActivityViewContext<KookwekkerAttributes>

    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            VStack(alignment: .leading, spacing: 3) {
                Text(kop)
                    .font(Letter.eyebrow)
                    .textCase(.uppercase)
                    .kerning(0.6)
                    .foregroundStyle(afgegaan(context) ? Kleur.waarschuwing : Kleur.gedempt)
                Text(context.attributes.stapTitel)
                    .font(Letter.kop(17))
                    .foregroundStyle(Kleur.inkt)
                    .lineLimit(2)
                Text(context.attributes.gerecht)
                    .font(Letter.tekst(13))
                    .foregroundStyle(Kleur.gedempt)
                    .lineLimit(1)
            }

            Spacer(minLength: 0)

            Klok(context: context, grootte: 32)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }

    private var kop: String {
        if afgegaan(context) { return "Klaar" }
        if context.state.gepauzeerd { return "Gepauzeerd" }
        return "Stap \(context.attributes.stap) van \(context.attributes.vanTotaal)"
    }
}

/// Het aftellen.
///
/// Drie standen, en maar één ervan telt echt: loopt hij, dan tekent SwiftUI het
/// zelf. Staat hij stil of is hij af, dan is het een gewoon getal.
private struct Klok: View {
    let context: ActivityViewContext<KookwekkerAttributes>
    let grootte: CGFloat

    var body: some View {
        Group {
            if afgegaan(context) {
                Text("0:00")
            } else if context.state.gepauzeerd {
                Text(context.state.restTekst)
            } else {
                Text(timerInterval: context.state.venster, countsDown: true)
                    .multilineTextAlignment(.trailing)
            }
        }
        .font(Letter.kop(grootte))
        .monospacedDigit()
        .foregroundStyle(afgegaan(context) ? Kleur.waarschuwing : Kleur.inkt)
    }
}

/// Is hij afgegaan?
///
/// Via `isStale` en niet via een vergelijking met `Date()`. Een widget tekent
/// niet uit zichzelf opnieuw op een willekeurig moment, dus een vergelijking
/// met de klok zou blijven staan op de stand van de laatste tekenbeurt.
/// `staleDate` is precies het haakje dat iOS daarvoor heeft.
private func afgegaan(_ context: ActivityViewContext<KookwekkerAttributes>) -> Bool {
    !context.state.gepauzeerd && context.isStale
}

private func regel(_ context: ActivityViewContext<KookwekkerAttributes>) -> String {
    let waar = "\(context.attributes.gerecht) · stap \(context.attributes.stap) van \(context.attributes.vanTotaal)"
    if afgegaan(context) { return "Klaar — \(waar)" }
    if context.state.gepauzeerd { return "Gepauzeerd — \(waar)" }
    return waar
}
