import SwiftUI

/// De kookmodus: één stap tegelijk, groot genoeg om vanaf het aanrecht te
/// lezen.
///
/// Dit is de vertaling van `src/components/CookMode.tsx`, met dezelfde
/// beslissingen: de stap is het hele scherm, de ingrediënten van díé stap staan
/// erbij en zijn af te vinken, en er staat altijd bij wat er straks komt — want
/// als er zo twintig minuten geprutteld moet worden, wil je dat weten terwijl
/// je nog staat te snijden.
///
/// Eén ding kan hier wat de browser niet kan: een lopende wekker staat ook op
/// het vergrendelscherm. Zie `Kookwekker`.
struct KookScherm: View {
    @Environment(\.dismiss) private var sluit
    @State private var sessie: Kooksessie
    @State private var alleIngredienten = false
    /// Naar het recept met het formulier open. Het enige moment dat je nog
    /// precies weet hoe het ging.
    let klaar: () -> Void

    @MainActor
    init(recept: Recept, porties: Int?, klaar: @escaping () -> Void) {
        _sessie = State(initialValue: Kooksessie(recept: recept, porties: porties))
        self.klaar = klaar
    }

    var body: some View {
        VStack(spacing: 0) {
            kop
            inhoud
            onderbalk
        }
        .background(Kleur.papier)
        .task { sessie.houdSchermAan() }
        .onDisappear { sessie.stop() }
    }

    // MARK: - Bovenin

    private var kop: some View {
        VStack(spacing: 10) {
            HStack {
                Button {
                    sessie.stop()
                    sluit()
                } label: {
                    Label("Stoppen", systemImage: "xmark")
                        .font(Letter.tekst(15))
                        .labelStyle(.titleAndIcon)
                }
                .tint(Kleur.gedempt)

                Spacer()

                Text(teller)
                    .font(Letter.tekst(14))
                    .foregroundStyle(Kleur.gedempt)
            }
            .frame(minHeight: Stijl.raakhoogte)

            voortgang
            elders
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 10)
        .background(Kleur.vel)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Kleur.lijn).frame(height: 1)
        }
        // Een wekker die afgaat mag onderbreken; dit is de regel die VoiceOver
        // voorleest zonder dat je het scherm hoeft te lezen.
        .accessibilityElement(children: .contain)
        .overlay {
            Text(alarmregel)
                .accessibilityAddTraits(.isHeader)
                .accessibilitySortPriority(1)
                .frame(width: 0, height: 0)
                .clipped()
                .accessibilityHidden(alarmregel.isEmpty)
        }
    }

    private var teller: String {
        var regel = "Stap \(sessie.huidige + 1) van \(sessie.recept.stappen.count)"
        if let porties = sessie.porties { regel += " · \(porties) pers." }
        return regel
    }

    /// Aantikbare streepjes. Ze stonden er toch al en ze zijn al zo breed als
    /// een duim; van stap vijf terug naar stap twee was anders drie keer
    /// "Vorige" met natte handen.
    private var voortgang: some View {
        HStack(spacing: 4) {
            ForEach(sessie.recept.stappen.indices, id: \.self) { index in
                let stap = sessie.recept.stappen[index]
                Button {
                    sessie.ga(naar: index)
                } label: {
                    // Het streepje is vier punten hoog; het raakvlak niet —
                    // vandaar de padding eromheen en de vorm eroverheen.
                    Capsule()
                        .fill(index <= sessie.huidige ? Kleur.salie : Kleur.lijn)
                        .frame(height: 4)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Naar stap \(index + 1)\(stap.titel.map { ": \($0)" } ?? "")")
            }
        }
    }

    @ViewBuilder
    private var elders: some View {
        if !sessie.elders.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(sessie.elders) { regel in
                        Button {
                            sessie.ga(naar: regel.stap)
                        } label: {
                            Text(
                                regel.wekker.af
                                    ? "Stap \(regel.stap + 1): klaar"
                                    : "Stap \(regel.stap + 1): \(Hoeveelheid.klok(sessie.resterend(regel.stap)))"
                            )
                            .font(Letter.tekst(13))
                            .monospacedDigit()
                            .padding(.horizontal, 12)
                            .frame(height: 30)
                            .background(
                                regel.wekker.af ? Kleur.zand : Kleur.salieZacht,
                                in: .capsule
                            )
                            .foregroundStyle(regel.wekker.af ? Kleur.waarschuwing : Kleur.inkt)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .scrollClipDisabled()
        }
    }

    // MARK: - De stap

    private var inhoud: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    // Een vast anker. De inhoud eronder krijgt bij elke stap
                    // een nieuwe id, dus daar valt niet naartoe te scrollen.
                    Color.clear.frame(height: 0).id(bovenaan)

                    if let stap = sessie.stap {
                        if let titel = stap.titel, !titel.isEmpty {
                            Text(titel)
                                .font(Letter.kop(26))
                                .foregroundStyle(Kleur.inkt)
                        }

                        nodigVoorDezeStap(stap)

                        Text(stap.tekst)
                            .font(Letter.tekst(19))
                            .lineSpacing(5)
                            .foregroundStyle(Kleur.tekst)

                        straks

                        if let minuten = stap.timerMinuten {
                            Wekkerblok(sessie: sessie, index: sessie.huidige, minuten: minuten)
                        }

                        if let tip = stap.tip, !tip.isEmpty {
                            tipblok(tip)
                        }
                    }

                    alleIngredientenBlok

                    Text("Het scherm blijft aan zolang je kookt.")
                        .font(Letter.tekst(13))
                        .foregroundStyle(Kleur.gedempt)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, 28)
                // De sleutel dwingt een nieuw blok af, en daarmee begint de
                // overgang opnieuw. Zonder dit verwisselt alleen de tekst en
                // gebeurt er bij de tweede stap niets meer.
                .id(sessie.huidige)
                .transition(
                    .asymmetric(
                        insertion: .move(edge: sessie.vooruit ? .trailing : .leading),
                        removal: .opacity
                    )
                )
            }
            .animation(.snappy(duration: 0.22), value: sessie.huidige)
            // Een nieuwe stap begin je bovenaan. Zonder dit blijf je staan waar
            // je was en land je middenin de tekst van de volgende stap.
            .onChange(of: sessie.huidige) { _, _ in
                proxy.scrollTo(bovenaan, anchor: .top)
            }
        }
    }

    private let bovenaan = "boven"

    @ViewBuilder
    private func nodigVoorDezeStap(_ stap: Stap) -> some View {
        let lijst = sessie.recept.ingredienten(voor: stap, porties: sessie.porties)
        if !lijst.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text("Nodig voor deze stap")
                    .font(Letter.eyebrow)
                    .textCase(.uppercase)
                    .kerning(0.6)
                    .foregroundStyle(Kleur.gedempt)

                // Af te tikken, met een streep erdoor. Bij een stap met acht
                // ingrediënten raak je anders kwijt wat er al in de pan ligt,
                // en dat is precies het moment waarop de deurbel gaat.
                ForEach(lijst.indices, id: \.self) { index in
                    let item = lijst[index]
                    let sleutel = "\(sessie.huidige):\(index)"
                    let erin = sessie.gepakt.contains(sleutel)
                    Button {
                        if erin { sessie.gepakt.remove(sleutel) } else { sessie.gepakt.insert(sleutel) }
                    } label: {
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            Image(systemName: erin ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(erin ? Kleur.salie : Kleur.lijn)
                            Text(Hoeveelheid.regel(item))
                                .font(Letter.tekst(17))
                                .strikethrough(erin, color: Kleur.gedempt)
                                .foregroundStyle(erin ? Kleur.gedempt : Kleur.tekst)
                                .multilineTextAlignment(.leading)
                            Spacer(minLength: 0)
                        }
                        .frame(minHeight: Stijl.raakhoogte - 8)
                        .contentShape(.rect)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(14)
            .background(Kleur.vel, in: .rect(cornerRadius: 14))
        }
    }

    @ViewBuilder
    private var straks: some View {
        if let na = sessie.volgende {
            VStack(alignment: .leading, spacing: 2) {
                Text("Straks")
                    .font(Letter.eyebrow)
                    .textCase(.uppercase)
                    .kerning(0.6)
                    .foregroundStyle(Kleur.gedempt)
                Text(na.titel ?? na.tekst)
                    .font(Letter.tekst(15))
                    .foregroundStyle(Kleur.gedempt)
                    .lineLimit(2)
            }
        }
    }

    private func tipblok(_ tip: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Label("Let op", systemImage: "lightbulb")
                .font(Letter.eyebrow)
                .textCase(.uppercase)
                .foregroundStyle(Kleur.waarschuwing)
            Text(tip)
                .font(Letter.tekst(15))
                .foregroundStyle(Kleur.tekst)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Kleur.zand, in: .rect(cornerRadius: 14))
    }

    private var alleIngredientenBlok: some View {
        DisclosureGroup(isExpanded: $alleIngredienten) {
            VStack(alignment: .leading, spacing: 10) {
                let groepen = sessie.recept.groepen(voor: sessie.porties)
                ForEach(groepen.indices, id: \.self) { groepnummer in
                    let groep = groepen[groepnummer]
                    if let naam = groep.naam, !naam.isEmpty {
                        Text(naam)
                            .font(Letter.eyebrow)
                            .textCase(.uppercase)
                            .foregroundStyle(Kleur.gedempt)
                    }
                    ForEach(groep.items.indices, id: \.self) { regelnummer in
                        Text(Hoeveelheid.regel(groep.items[regelnummer]))
                            .font(Letter.tekst(15))
                            .foregroundStyle(Kleur.tekst)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }
            .padding(.top, 8)
        } label: {
            Text("Alle ingrediënten")
                .font(Letter.tekst(15))
                .foregroundStyle(Kleur.inkt)
        }
        .tint(Kleur.salie)
        .padding(14)
        .background(Kleur.vel, in: .rect(cornerRadius: 14))
    }

    // MARK: - Onderin

    private var onderbalk: some View {
        HStack(spacing: 10) {
            Button {
                sessie.ga(naar: sessie.huidige - 1)
            } label: {
                Label("Vorige", systemImage: "chevron.left")
                    .font(Letter.tekst(16))
                    .frame(maxWidth: .infinity, minHeight: Stijl.raakhoogte + 4)
            }
            .buttonStyle(.plain)
            .background(Kleur.vel, in: .rect(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Kleur.lijn, lineWidth: 1))
            .foregroundStyle(sessie.huidige == 0 ? Kleur.gedempt : Kleur.tekst)
            .disabled(sessie.huidige == 0)

            Button {
                if sessie.isLaatste {
                    sessie.stop()
                    klaar()
                } else {
                    sessie.ga(naar: sessie.huidige + 1)
                }
            } label: {
                Group {
                    if sessie.isLaatste {
                        Text("Klaar — eet smakelijk")
                    } else {
                        Label("Volgende stap", systemImage: "chevron.right")
                            .labelStyle(AchterstevorenLabel())
                    }
                }
                .font(Letter.tekst(16))
                .frame(maxWidth: .infinity, minHeight: Stijl.raakhoogte + 4)
            }
            .buttonStyle(.plain)
            .background(Kleur.salie, in: .rect(cornerRadius: 12))
            .foregroundStyle(Kleur.salieInkt)
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .background(Kleur.vel)
        .overlay(alignment: .top) {
            Rectangle().fill(Kleur.lijn).frame(height: 1)
        }
    }
}

/// Icoon rechts van de tekst; "volgende" wijst vooruit en dat hoort ook zo te
/// staan.
private struct AchterstevorenLabel: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 6) {
            configuration.title
            configuration.icon
        }
    }
}

/// Het wekkerblok bij een stap.
///
/// Drie standen in één blok: nog niet gestart, lopend of stil, en afgegaan. De
/// tijd is het grootste element en er zakt een balkje leeg, zodat je van een
/// meter afstand ziet hoe ver hij is.
private struct Wekkerblok: View {
    let sessie: Kooksessie
    let index: Int
    let minuten: Int

    private var wekker: Kooksessie.Wekker? { sessie.wekkers[index] }
    private var af: Bool { wekker?.af ?? false }
    private var loopt: Bool { wekker?.loopt ?? false }

    private var seconden: Int {
        wekker == nil ? minuten * 60 : sessie.resterend(index)
    }

    private var deel: Double {
        let totaal = Double(minuten * 60)
        guard totaal > 0 else { return 0 }
        if af { return 0 }
        if wekker == nil { return 1 }
        return min(1, max(0, Double(seconden) / totaal))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(af ? "De tijd is om" : loopt ? "Loopt" : wekker == nil ? "Wekker" : "Staat stil")
                        .font(Letter.eyebrow)
                        .textCase(.uppercase)
                        .kerning(0.6)
                        .foregroundStyle(af ? Kleur.waarschuwing : Kleur.gedempt)
                    Text(Hoeveelheid.klok(seconden))
                        .font(Letter.kop(34))
                        .monospacedDigit()
                        .foregroundStyle(af ? Kleur.waarschuwing : Kleur.inkt)
                }

                Spacer()

                HStack(spacing: 8) {
                    if loopt {
                        rondeKnop("pause.fill", label: "Pauzeren") { sessie.pauzeer(index) }
                    } else {
                        rondeKnop(af ? "arrow.clockwise" : "play.fill", label: af ? "Opnieuw" : "Starten") {
                            sessie.start(index, minuten: minuten)
                        }
                    }
                    if wekker != nil {
                        rondeKnop("xmark", label: "Wekker weg") { sessie.wis(index) }
                    }
                }
            }

            GeometryReader { maat in
                ZStack(alignment: .leading) {
                    Capsule().fill(Kleur.lijn)
                    Capsule()
                        .fill(af ? Kleur.waarschuwing : Kleur.salie)
                        .frame(width: maat.size.width * deel)
                }
            }
            .frame(height: 6)
        }
        .padding(16)
        .background(af ? Kleur.zand : Kleur.salieZacht, in: .rect(cornerRadius: 16))
        .animation(.default, value: af)
    }

    private func rondeKnop(_ icoon: String, label: String, doe: @escaping () -> Void) -> some View {
        Button(action: doe) {
            Image(systemName: icoon)
                .font(.system(size: 15, weight: .semibold))
                .frame(width: Stijl.raakhoogte, height: Stijl.raakhoogte)
                .background(Kleur.vel, in: .circle)
                .foregroundStyle(Kleur.inkt)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}
