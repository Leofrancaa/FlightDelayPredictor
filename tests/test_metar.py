from module_decea.metar import decodificar


def test_visibilidade_em_milhas_e_teto_mais_baixo():
    d = decodificar("KATL 010052Z 33008G18KT 1 1/2SM -TSRA BR BKN008 OVC020 06/M04 A3021 RMK AO2")
    assert d["vis_m"] == round(1.5 * 1609.34)
    assert d["teto_ft"] == 800 and d["rajada_kt"] == 18 and d["trovoada"] and d["chuva"]
    assert (d["vento_dir"], d["vento_kt"]) == (330, 8)
    assert (d["temp_c"], d["orvalho_c"]) == (6, -4)
    assert d["qnh"] == round(30.21 * 33.8639)


def test_ceu_limpo_e_visibilidade_maxima():
    d = decodificar("KSEA 010053Z 00000KT 10SM CLR 10/05 A3001")
    assert (d["vis_m"], d["teto_ft"]) == (9999, 99999)


def test_rmk_nao_entra_na_decodificacao():
    d = decodificar("KORD 011651Z 27012KT 10SM FEW250 M02/M10 A3012 RMK AO2 SLP205 TSB45")
    assert not d["trovoada"]
    assert d["teto_ft"] == 99999
