from module_decea.metar import decodificar


def test_cavok_vale_visibilidade_maxima_e_ceu_ilimitado():
    d = decodificar("SBGR 101200Z 09010KT CAVOK 25/15 Q1015")
    assert (d["vis_m"], d["teto_ft"]) == (9999, 99999)
    assert (d["vento_dir"], d["vento_kt"]) == (90, 10)
    assert (d["temp_c"], d["orvalho_c"], d["qnh"]) == (25, 15, 1015)


def test_teto_e_a_camada_bkn_ovc_mais_baixa():
    d = decodificar("SBSP 101800Z 32015G28KT 3000 TSRA FEW015CB BKN008 OVC020 18/17 Q1012")
    assert d["teto_ft"] == 800
    assert d["vis_m"] == 3000
    assert d["rajada_kt"] == 28
    assert d["trovoada"] and d["chuva"] and d["cb"]


def test_decodificar_metar_dos_eua():
    from module_decea.metar import decodificar

    d = decodificar("KATL 010052Z 33008G18KT 1 1/2SM -TSRA BR BKN008 OVC020 06/M04 A3021 RMK AO2")
    assert d["vis_m"] == round(1.5 * 1609.34)
    assert d["teto_ft"] == 800 and d["rajada_kt"] == 18 and d["trovoada"] and d["chuva"]
    assert d["qnh"] == round(30.21 * 33.8639)
    assert decodificar("KSEA 010053Z 00000KT 10SM CLR 10/05 A3001")["vis_m"] == 9999
    assert decodificar("SBGR 010000Z 09005KT 6000 BKN015 20/18 Q1015")["vis_m"] == 6000
