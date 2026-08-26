import SwiftUI

/// Eén recept: lezen, omrekenen, en van hieruit koken.
///
/// De volgorde is die van de website en die is met een reden zo: eerst waar je
/// naar keek toen je erop tikte (de foto en de titel), dan waar je meteen aan
/// wilt draaien (het aantal personen), dan de boodschappen, dan het koken. Wat
/// je pas achteraf leest — tips, aannames, wie het wanneer maakte — staat
/// onderaan.
struct ReceptScherm: View {
    @Environment(Voorraad.self) private var voorraad
    let recept: Recept

    @State private var porties: Int?
    @State private var koken = false
    @State private var gemaakt = false
    /// Kwam je uit de kookmodus met "eet smakelijk"? Dan wil je het formulier.
    @State private var netGekookt = false

    /// De verse versie uit de kast.
    ///
    /// De lijst waar je op tikte kan van een seconde geleden zijn, en na
    /// *Gemaakt* hoort de kooklog hier meteen te kloppen zonder dat je terug
    /// hoeft.
    private var nu: Recept {
        voorraad.recepten.first { $0.id == recept.id } ?? recept
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                foto
                kop
                if let omschrijving = nu.omschrijving, !omschrijving.isEmpty {
                    Text(omschrijving)
                        .font(Letter.tekst(16))
                        .foregroundStyle(Kleur.tekst)
                }
                portieteller
                kookknop
                ingredienten
                stappen
                tips
                kooklog
                herkomst
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.bottom, 40)
        }
        .background(Kleur.papier)
        .navigationTitle(nu.titel)
        .navigationBarTitleDisplayMode(.inline)
        .task { if porties == nil { porties = beginporties } }
        // Het formulier pas ná het sluiten van de kookmodus. Allebei in één
        // beurt aanzetten laat SwiftUI de tweede vallen, en dan sta je terug op
        // het recept zonder dat er iets gebeurde.
        .fullScreenCover(isPresented: $koken, onDismiss: naDeKookmodus) {
            KookScherm(recept: nu, porties: porties) {
                netGekookt = true
                koken = false
            }
        }
        .sheet(isPresented: $gemaakt) {
            GemaaktBlad(recept: nu)
        }
    }

    private func naDeKookmodus() {
        guard netGekookt else { return }
        netGekookt = false
        // Dit is het enige moment dat je nog precies weet hoe het ging.
        gemaakt = true
    }

    private var beginporties: Int? {
        Hoeveelheid.beginporties(bron: nu.porties, huishouden: voorraad.instellingen.huishouden)
    }

    // MARK: - Bovenaan

    @ViewBuilder
    private var foto: some View {
        if let url = voorraad.fotoURL(nu.foto) {
            AsyncImage(url: url) { beeld in
                beeld.resizable().scaledToFill()
            } placeholder: {
                Rectangle().fill(Kleur.verzonken)
            }
            .frame(maxWidth: .infinity)
            .aspectRatio(4 / 3, contentMode: .fit)
            .clipShape(.rect(cornerRadius: 16))
        }
    }

    private var kop: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(nu.titel)
                .font(Letter.kop(28))
                .foregroundStyle(Kleur.inkt)

            if !metaregel.isEmpty {
                Text(metaregel)
                    .font(Letter.tekst(14))
                    .foregroundStyle(Kleur.gedempt)
            }

            if let cijfer = nu.cijfer {
                Sterren(waarde: Int(cijfer.rounded()))
            }
        }
    }

    private var metaregel: String {
        var delen: [String] = []
        if let minuten = nu.totaalMinuten { delen.append("\(minuten) min") }
        if let keuken = nu.keuken, !keuken.isEmpty { delen.append(keuken) }
        delen.append(contentsOf: nu.momenten.map(\.capitalized))
        delen.append(contentsOf: nu.dieet.map(\.capitalized))
        return delen.joined(separator: " · ")
    }

    // MARK: - Personen

    @ViewBuilder
    private var portieteller: some View {
        if let bron = nu.porties, bron > 0, let huidig = porties {
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 14) {
                    Text("Voor")
                        .font(Letter.tekst(16))
                        .foregroundStyle(Kleur.tekst)

                    knop("minus", label: "Minder personen") {
                        porties = Hoeveelheid.begrens(huidig - 1)
                    }
                    .disabled(huidig <= Hoeveelheid.laagstePorties)

                    Text("\(huidig)")
                        .font(Letter.kop(22))
                        .monospacedDigit()
                        .frame(minWidth: 32)
                        .foregroundStyle(Kleur.inkt)

                    knop("plus", label: "Meer personen") {
                        porties = Hoeveelheid.begrens(huidig + 1)
                    }
                    .disabled(huidig >= Hoeveelheid.hoogstePorties)

                    Text(huidig == 1 ? "persoon" : "personen")
                        .font(Letter.tekst(16))
                        .foregroundStyle(Kleur.tekst)
                }

                if huidig != bron {
                    // Eerlijk zijn over wat er wél en niet is meegerekend. De
                    // getallen in de staptekst schalen niet mee; die
                    // herschrijven is tekstmanipulatie waarbij je meer
                    // stukmaakt dan je oplost.
                    Text("Omgerekend van \(bron) naar \(huidig) personen. De hoeveelheden kloppen; getallen in de staptekst niet.")
                        .font(Letter.tekst(13))
                        .foregroundStyle(Kleur.gedempt)
                }
            }
            .padding(14)
            .background(Kleur.vel, in: .rect(cornerRadius: 14))
        }
    }

    private func knop(_ icoon: String, label: String, doe: @escaping () -> Void) -> some View {
        Button(action: doe) {
            Image(systemName: icoon)
                .font(.system(size: 14, weight: .semibold))
                .frame(width: Stijl.raakhoogte, height: Stijl.raakhoogte)
                .background(Kleur.verzonken, in: .circle)
                .foregroundStyle(Kleur.inkt)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    // MARK: - Koken

    @ViewBuilder
    private var kookknop: some View {
        if !nu.stappen.isEmpty {
            Button {
                koken = true
            } label: {
                Label("Koken", systemImage: "flame")
                    .font(Letter.tekst(17))
                    .frame(maxWidth: .infinity, minHeight: Stijl.raakhoogte + 6)
                    .background(Kleur.salie, in: .rect(cornerRadius: 12))
                    .foregroundStyle(Kleur.salieInkt)
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - De lijsten

    @ViewBuilder
    private var ingredienten: some View {
        let groepen = nu.groepen(voor: porties)
        if !groepen.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Kopje("Ingrediënten")
                ForEach(groepen.indices, id: \.self) { groepnummer in
                    let groep = groepen[groepnummer]
                    if let naam = groep.naam, !naam.isEmpty {
                        Text(naam)
                            .font(Letter.eyebrow)
                            .textCase(.uppercase)
                            .kerning(0.6)
                            .foregroundStyle(Kleur.gedempt)
                            .padding(.top, 4)
                    }
                    ForEach(groep.items.indices, id: \.self) { regelnummer in
                        let item = groep.items[regelnummer]
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            // De hoeveelheden op kolom: zo lees je een lijst,
                            // en zo zie je in één oogopslag of je genoeg hebt.
                            Text(Hoeveelheid.tekst(item))
                                .font(Letter.tekst(16))
                                .monospacedDigit()
                                .foregroundStyle(Kleur.inkt)
                                .frame(width: 74, alignment: .trailing)
                            Text(regel(item))
                                .font(Letter.tekst(16))
                                .foregroundStyle(Kleur.tekst)
                            Spacer(minLength: 0)
                        }
                    }
                }
            }
        }
    }

    private func regel(_ item: Ingredient) -> String {
        guard let notitie = item.notitie, !notitie.isEmpty else { return item.naam }
        return "\(item.naam), \(notitie)"
    }

    @ViewBuilder
    private var stappen: some View {
        if !nu.stappen.isEmpty {
            VStack(alignment: .leading, spacing: 14) {
                Kopje("Zo maak je het")
                ForEach(nu.stappen.indices, id: \.self) { index in
                    let stap = nu.stappen[index]
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        Text("\(index + 1)")
                            .font(Letter.kop(15))
                            .monospacedDigit()
                            .frame(width: 26, height: 26)
                            .background(Kleur.salieZacht, in: .circle)
                            .foregroundStyle(Kleur.salie)

                        VStack(alignment: .leading, spacing: 3) {
                            if let titel = stap.titel, !titel.isEmpty {
                                Text(titel)
                                    .font(Letter.kop(17))
                                    .foregroundStyle(Kleur.inkt)
                            }
                            Text(stap.tekst)
                                .font(Letter.tekst(16))
                                .foregroundStyle(Kleur.tekst)
                            if let minuten = stap.timerMinuten {
                                Label("\(minuten) min", systemImage: "timer")
                                    .font(Letter.tekst(13))
                                    .foregroundStyle(Kleur.gedempt)
                            }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var tips: some View {
        if !nu.tips.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Kopje("Tips")
                ForEach(nu.tips, id: \.self) { tip in
                    Text("· \(tip)")
                        .font(Letter.tekst(15))
                        .foregroundStyle(Kleur.tekst)
                }
            }
        }
    }

    // MARK: - Achteraf

    @ViewBuilder
    private var kooklog: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Kopje("Gemaakt")
                Spacer()
                Button("Noteren") { gemaakt = true }
                    .font(Letter.tekst(15))
                    .tint(Kleur.salie)
                    .frame(minHeight: Stijl.raakhoogte)
            }

            if nu.kooklog.isEmpty {
                Text("Nog nooit gemaakt.")
                    .font(Letter.tekst(15))
                    .foregroundStyle(Kleur.gedempt)
            } else {
                ForEach(nu.kooklog) { regel in
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 8) {
                            Text(regel.gemaaktOp)
                                .font(Letter.tekst(14))
                                .monospacedDigit()
                                .foregroundStyle(Kleur.gedempt)
                            if let sterren = regel.sterren {
                                Sterren(waarde: sterren)
                            }
                            if let wie = regel.wie, !wie.isEmpty {
                                Text(wie)
                                    .font(Letter.tekst(14))
                                    .foregroundStyle(Kleur.gedempt)
                            }
                        }
                        if let notitie = regel.notitie, !notitie.isEmpty {
                            Text(notitie)
                                .font(Letter.tekst(15))
                                .foregroundStyle(Kleur.tekst)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var herkomst: some View {
        VStack(alignment: .leading, spacing: 6) {
            if !nu.aannames.isEmpty {
                Kopje("Aannames")
                ForEach(nu.aannames, id: \.self) { aanname in
                    Text("· \(aanname)")
                        .font(Letter.tekst(14))
                        .foregroundStyle(Kleur.gedempt)
                }
            }
            if let bron = nu.bron, let adres = bron.url, let url = URL(string: adres) {
                Link(bron.naam ?? adres, destination: url)
                    .font(Letter.tekst(14))
                    .tint(Kleur.salie)
                    .frame(minHeight: Stijl.raakhoogte)
            }
        }
    }
}

/// Een kopje boven een blok. Overal hetzelfde, dus één keer opgeschreven.
struct Kopje: View {
    let tekst: String

    init(_ tekst: String) { self.tekst = tekst }

    var body: some View {
        Text(tekst)
            .font(Letter.kop(20))
            .foregroundStyle(Kleur.inkt)
    }
}
