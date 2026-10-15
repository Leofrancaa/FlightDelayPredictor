import numpy as np
import pandas as pd

from module_decea.features import _voo_chegada, para_local, para_utc


def test_para_utc_segue_horario_de_verao():
    t = pd.Series(pd.to_datetime(["2016-12-01 12:00", "2016-07-01 12:00", "2024-12-01 12:00"]))
    u = para_utc(t)
    assert list(u.dt.hour) == [14, 15, 15]  # verão de 2016 era UTC-2; 2024 já não tem horário de verão
    assert (para_local(u) == t).all()


def test_voo_chegada_cancelado_ou_sem_registro_nao_conta_como_preso():
    partida = pd.Timestamp("2025-03-01 12:00")
    v = pd.DataFrame({"partida_prev": [partida] * 4})
    prev_chegada = partida - pd.Timedelta(hours=3)  # o voo de chegada devia ter saído 3 h antes
    m = pd.DataFrame(
        {
            "in_partida_prev": [prev_chegada] * 4,
            # saiu 20 min atrasado | ainda não saiu (sai depois de ref) | cancelado | sem partida real registrada
            "in_partida_real": [prev_chegada + pd.Timedelta(minutes=20), partida, pd.NaT, pd.NaT],
            "in_cancelado": [False, False, True, False],
        }
    )
    f = _voo_chegada(v, m, h=1)
    assert f["chegada_atraso_conhecido"].iloc[0] == 20
    assert f["chegada_ainda_nao_partiu"].tolist() == [0, 1, 0, 0]
    assert f["chegada_atraso_conhecido"].iloc[1] == 120  # ref (11:00) - previsto (09:00)
    assert np.isnan(f["chegada_atraso_conhecido"].iloc[2]) and np.isnan(f["chegada_atraso_conhecido"].iloc[3])
    assert f["chegada_cancelada"].tolist() == [0, 0, 1, 0]
