import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import {
  requireRhAccess,
  requireRhAusenciasWrite,
  requireRhConfigAccess,
  requireRhConfigPermission,
  requireRhFeaturePermission,
  requireRhMaster,
  requireRhMotivoDesligamentoEdit,
  requireRhMotivoDesligamentoView,
  requireRhRegrasAlertasEdit,
  requireRhRegrasAlertasView,
  requireRhSancoesWrite,
  requireRhSession,
} from '../rh/middleware/rhAuth.js';
import {
  rhUserGroupsCreateHandler,
  rhUserGroupsDeleteHandler,
  rhUserGroupsListHandler,
  rhUserGroupsUpdateHandler,
} from '../rh/controllers/adminController.js';
import {
  getFaltasAlertaEnquadramentosHandler,
  getFaltasAlertaInconsistenciasHandler,
  getFaltasAlertaRegrasHandler,
  registrarFaltasAlertaAusenciaHandler,
  removerFaltasAlertaPorFaltasHandler,
  setFaltasAlertaRegraAtivaHandler,
  updateFaltasAlertaInconsistenciaHandler,
} from '../rh/controllers/alertasController.js';
import { rhBackupExportHandler, rhBackupImportHandler } from '../rh/controllers/backupController.js';
import { getConfigHandler, setConfigHandler } from '../rh/controllers/configController.js';
import {
  getCargosHandler,
  getColaboradoresHandler,
  getDashboardHandler,
  getRelatoriosHandler,
  setCargoFaixaHandler,
} from '../rh/controllers/dashboardController.js';
import {
  deleteOrganicoDocumentHandler,
  downloadOrganicoDocumentHandler,
  getOrganicoDocumentsHandler,
  resolveLaunchDocumentsHandler,
  uploadOrganicoDocumentHandler,
} from '../rh/controllers/documentsController.js';
import {
  getFaltasAtestadosHandler,
  getFaltasCadastrosHandler,
  getPontualidadePontoHandler,
  getSancoesDisciplinaresHandler,
  replaceFaltasAtestadosHandler,
  replaceFaltasCadastrosHandler,
  replacePontualidadePontoHandler,
  replaceSancoesDisciplinaresHandler,
} from '../rh/controllers/faltasController.js';
import {
  addOrganicoComentarioHandler,
  createOrganicoArchiveFolderHandler,
  deleteOrganicoAlteracaoPendenteHandler,
  deleteOrganicoComentarioHandler,
  deleteOrganicoFotoHandler,
  deleteOrganicoTrajetoriaHandler,
  getOrganico,
  getOrganicoAlteracoesPendentesHandler,
  getOrganicoComentariosHandler,
  getOrganicoFotoHandler,
  getOrganicoRepresentantesHandler,
  getOrganicoRepresentantesDadosHandler,
  getOrganicoTrajetoriaHandler,
  getOrganicoSalariosTrajetoriaHandler,
  hideOrganicoArchiveFolderHandler,
  importOrganicoTrajetoriaHandler,
  parseOrganicoTrajetoriaPdfHandler,
  renameOrganicoArchiveFolderHandler,
  replaceOrganico,
  resolveOrganicoAlteracaoPendenteHandler,
  secullumFuncionariosHandler,
  setOrganicoFotoHandler,
  setOrganicoRepresentanteHandler,
  syncOrganicoRepresentantesHandler,
  upsertOrganicoAlteracoesPendentesHandler,
} from '../rh/controllers/organicoController.js';
import { rhSessionPermissionsHandler } from '../rh/controllers/sessionController.js';
import {
  getDesligamentosComplementosHandler,
  getMotivosDesligamentoHandler,
  replaceMotivosDesligamentoFilhosHandler,
  salvarDesligamentoComplementoHandler,
} from '../rh/controllers/motivoDesligamentoController.js';
import { geocodeLocalidadesHandler } from '../rh/services/geocodeLocalidade.js';
import { MAX_DOCUMENT_SIZE_BYTES } from '../rh/utils/rhUpload.js';
import {
  anexarPrintHandler,
  atualizarCardHandler,
  criarCardHandler,
  criarListaHandler,
  criarQuadroHandler,
  excluirAnexoHandler,
  excluirCardHandler,
  excluirListaHandler,
  excluirQuadroHandler,
  getDemandasHandler,
  moverCardHandler,
  moverListaHandler,
  renomearListaHandler,
  renomearQuadroHandler,
} from '../rh/controllers/demandasInternasController.js';
import {
  atualizarVagaHandler,
  criarVagaHandler,
  excluirVagaHandler,
  getVagasHandler,
} from '../rh/controllers/vagasController.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES },
});

const uploadPrint = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function receberPrint(
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction,
) {
  uploadPrint.single('file')(req, res, (err: unknown) => {
    if (err) {
      const grande = !!err && typeof err === 'object' && (err as { code?: string }).code === 'LIMIT_FILE_SIZE';
      res.status(400).json({ error: grande ? 'O print passa de 15 MB.' : 'Não foi possível receber o arquivo.' });
      return;
    }
    anexarPrintHandler(req, res).catch(next);
  });
}

router.use(requireAuth);

const wrap =
  (handler: (req: import('express').Request, res: import('express').Response) => Promise<void>) =>
  (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    handler(req, res).catch(next);
  };

// Sessão / permissões
router.get('/rh-session-permissions', requireRhSession(), wrap(rhSessionPermissionsHandler));

// Config
router.get('/get-config', requireRhConfigPermission('view'), wrap(getConfigHandler));
router.post('/set-config', requireRhConfigPermission('edit'), wrap(setConfigHandler));

// Orgânico
router.get('/get-organico', requireRhAccess('/organico', 'view'), wrap(getOrganico));
router.post('/replace-organico', requireRhAccess('/organico', 'edit'), wrap(replaceOrganico));

// Faltas / atestados
router.get('/get-faltas-atestados', requireRhFeaturePermission('ausencias', 'view'), wrap(getFaltasAtestadosHandler));
router.post('/replace-faltas-atestados', requireRhAusenciasWrite(), wrap(replaceFaltasAtestadosHandler));
router.get('/get-sancoes-disciplinares', requireRhFeaturePermission('sancoes', 'view'), wrap(getSancoesDisciplinaresHandler));
router.post('/replace-sancoes-disciplinares', requireRhSancoesWrite(), wrap(replaceSancoesDisciplinaresHandler));
router.get('/get-faltas-cadastros', requireRhFeaturePermission('cadastros', 'view'), wrap(getFaltasCadastrosHandler));
router.post('/replace-faltas-cadastros', requireRhFeaturePermission('cadastros', 'edit'), wrap(replaceFaltasCadastrosHandler));

// Dashboard / cargos / colaboradores / relatórios
router.get('/get-dashboard', requireRhAccess('/dashboard#executivo', 'view'), wrap(getDashboardHandler));
router.get(
  '/get-organico-salarios-trajetoria',
  requireRhAccess('/dashboard#executivo', 'view'),
  wrap(getOrganicoSalariosTrajetoriaHandler),
);
router.get('/get-cargos', requireRhAccess('/cargos', 'view'), wrap(getCargosHandler));
router.get('/get-colaboradores', requireRhAccess('/organico', 'view'), wrap(getColaboradoresHandler));
router.get('/get-relatorios', requireRhAccess('/dashboard#executivo', 'view'), wrap(getRelatoriosHandler));
router.get('/get-pontualidade-ponto', requireRhAccess('/dashboard#absenteismo-horas', 'view'), wrap(getPontualidadePontoHandler));
router.post('/replace-pontualidade-ponto', requireRhAccess('/dashboard#absenteismo-horas', 'edit'), wrap(replacePontualidadePontoHandler));
router.post('/set-cargo-faixa', requireRhAccess('/cargos', 'edit'), wrap(setCargoFaixaHandler));

// Alertas de faltas
router.get('/get-faltas-alerta-regras', requireRhRegrasAlertasView(), wrap(getFaltasAlertaRegrasHandler));
router.post('/set-faltas-alerta-regra-ativa', requireRhRegrasAlertasEdit(), wrap(setFaltasAlertaRegraAtivaHandler));
router.get('/get-faltas-alerta-enquadramentos', requireRhRegrasAlertasView(), wrap(getFaltasAlertaEnquadramentosHandler));
router.get('/get-faltas-alerta-inconsistencias', requireRhRegrasAlertasView(), wrap(getFaltasAlertaInconsistenciasHandler));
router.post('/get-faltas-alerta-inconsistencias', requireRhRegrasAlertasView(), wrap(getFaltasAlertaInconsistenciasHandler));
router.post('/update-faltas-alerta-inconsistencia', requireRhRegrasAlertasEdit(), wrap(updateFaltasAlertaInconsistenciaHandler));
router.post('/registrar-faltas-alerta-ausencia', requireRhRegrasAlertasEdit(), wrap(registrarFaltasAlertaAusenciaHandler));
router.post('/remover-faltas-alerta-por-faltas', requireRhRegrasAlertasEdit(), wrap(removerFaltasAlertaPorFaltasHandler));

// Comentários / fotos / documentos / trajetória
router.get('/get-organico-comentarios', requireRhFeaturePermission('comentarios', 'view'), wrap(getOrganicoComentariosHandler));
router.post('/add-organico-comentario', requireRhFeaturePermission('comentarios', 'create'), wrap(addOrganicoComentarioHandler));
router.post('/delete-organico-comentario', requireRhFeaturePermission('comentarios', 'delete'), wrap(deleteOrganicoComentarioHandler));
router.get('/get-organico-foto', requireRhFeaturePermission('fotos', 'view'), wrap(getOrganicoFotoHandler));
router.post('/set-organico-foto', requireRhFeaturePermission('fotos', 'edit'), wrap(setOrganicoFotoHandler));
router.post('/delete-organico-foto', requireRhFeaturePermission('fotos', 'edit'), wrap(deleteOrganicoFotoHandler));
router.get('/get-organico-documents', requireRhFeaturePermission('documentos', 'view'), wrap(getOrganicoDocumentsHandler));
router.post(
  '/upload-organico-document',
  requireRhFeaturePermission('documentos', 'create'),
  upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
  ]),
  wrap(uploadOrganicoDocumentHandler),
);
router.get('/download-organico-document', requireRhFeaturePermission('documentos', 'download'), wrap(downloadOrganicoDocumentHandler));
router.post('/delete-organico-document', requireRhFeaturePermission('documentos', 'delete'), wrap(deleteOrganicoDocumentHandler));
router.get('/get-organico-trajetoria', requireRhAccess('/organico', 'view'), wrap(getOrganicoTrajetoriaHandler));
router.post('/import-organico-trajetoria', requireRhAccess('/organico', 'edit'), wrap(importOrganicoTrajetoriaHandler));
router.post('/parse-organico-trajetoria-pdf', requireRhAccess('/organico', 'edit'), wrap(parseOrganicoTrajetoriaPdfHandler));
router.post('/delete-organico-trajetoria', requireRhAccess('/organico', 'edit'), wrap(deleteOrganicoTrajetoriaHandler));

// Alterações pendentes / representantes / pastas
router.get('/get-organico-alteracoes-pendentes', requireRhAccess('/organico', 'view'), wrap(getOrganicoAlteracoesPendentesHandler));
router.post('/upsert-organico-alteracoes-pendentes', requireRhAccess('/organico', 'edit'), wrap(upsertOrganicoAlteracoesPendentesHandler));
router.post('/resolve-organico-alteracao-pendente', requireRhAccess('/organico', 'edit'), wrap(resolveOrganicoAlteracaoPendenteHandler));
router.post('/delete-organico-alteracao-pendente', requireRhAccess('/organico', 'edit'), wrap(deleteOrganicoAlteracaoPendenteHandler));
router.get('/get-organico-representantes', requireRhAccess('/organico', 'view'), wrap(getOrganicoRepresentantesHandler));
router.get('/get-organico-representantes-dados', requireRhAccess('/organico', 'view'), wrap(getOrganicoRepresentantesDadosHandler));
router.post('/sync-organico-representantes', requireRhAccess('/organico', 'edit'), wrap(syncOrganicoRepresentantesHandler));
router.post('/set-organico-representante', requireRhAccess('/organico', 'edit'), wrap(setOrganicoRepresentanteHandler));
router.get('/secullum-funcionarios', requireRhAccess('/organico', 'view'), wrap(secullumFuncionariosHandler));
router.get('/get-motivos-desligamento', requireRhMotivoDesligamentoView(), wrap(getMotivosDesligamentoHandler));
router.post('/replace-motivos-desligamento-filhos', requireRhMotivoDesligamentoEdit(), wrap(replaceMotivosDesligamentoFilhosHandler));
router.get('/get-desligamentos-complementos', requireRhMotivoDesligamentoView(), wrap(getDesligamentosComplementosHandler));
router.post('/salvar-desligamento-complemento', requireRhAccess('/organico', 'edit'), wrap(salvarDesligamentoComplementoHandler));
router.post('/geocode-localidades', requireRhAccess('/organico', 'view'), wrap(geocodeLocalidadesHandler));
router.post('/create-organico-archive-folder', requireRhFeaturePermission('documentos', 'create'), wrap(createOrganicoArchiveFolderHandler));
router.post('/rename-organico-archive-folder', requireRhFeaturePermission('documentos', 'edit'), wrap(renameOrganicoArchiveFolderHandler));
router.post('/hide-organico-archive-folder', requireRhFeaturePermission('documentos', 'edit'), wrap(hideOrganicoArchiveFolderHandler));
router.post('/resolve-launch-documents', requireRhFeaturePermission('ausencias', 'view'), wrap(resolveLaunchDocumentsHandler));

router.get('/demandas-internas', requireRhAccess('/demandas-internas', 'view'), wrap(getDemandasHandler));
router.post('/demandas-internas/quadros', requireRhAccess('/demandas-internas', 'edit'), wrap(criarQuadroHandler));
router.patch('/demandas-internas/quadros/:id', requireRhAccess('/demandas-internas', 'edit'), wrap(renomearQuadroHandler));
router.delete('/demandas-internas/quadros/:id', requireRhAccess('/demandas-internas', 'edit'), wrap(excluirQuadroHandler));
router.post('/demandas-internas/listas', requireRhAccess('/demandas-internas', 'edit'), wrap(criarListaHandler));
router.patch('/demandas-internas/listas/:id', requireRhAccess('/demandas-internas', 'edit'), wrap(renomearListaHandler));
router.post('/demandas-internas/listas/:id/mover', requireRhAccess('/demandas-internas', 'edit'), wrap(moverListaHandler));
router.delete('/demandas-internas/listas/:id', requireRhAccess('/demandas-internas', 'edit'), wrap(excluirListaHandler));
router.post('/demandas-internas/cards', requireRhAccess('/demandas-internas', 'edit'), wrap(criarCardHandler));
router.patch('/demandas-internas/cards/:id', requireRhAccess('/demandas-internas', 'edit'), wrap(atualizarCardHandler));
router.post('/demandas-internas/cards/:id/mover', requireRhAccess('/demandas-internas', 'edit'), wrap(moverCardHandler));
router.delete('/demandas-internas/cards/:id', requireRhAccess('/demandas-internas', 'edit'), wrap(excluirCardHandler));
router.post('/demandas-internas/cards/:id/anexos', requireRhAccess('/demandas-internas', 'edit'), receberPrint);
router.delete('/demandas-internas/anexos/:id', requireRhAccess('/demandas-internas', 'edit'), wrap(excluirAnexoHandler));

router.get('/vagas', requireRhAccess('/vagas', 'view'), wrap(getVagasHandler));
router.post('/vagas', requireRhAccess('/vagas', 'edit'), wrap(criarVagaHandler));
router.patch('/vagas/:id', requireRhAccess('/vagas', 'edit'), wrap(atualizarVagaHandler));
router.delete('/vagas/:id', requireRhAccess('/vagas', 'edit'), wrap(excluirVagaHandler));

// Backup / grupos RH (Gestor grupos + rhGrupoPermissao)
router.get('/rh-backup-export', requireRhMaster(), wrap(rhBackupExportHandler));
router.post('/rh-backup-import', requireRhMaster(), wrap(rhBackupImportHandler));
router.post('/rh-user-groups-list', requireRhConfigAccess('view'), wrap(rhUserGroupsListHandler));
router.post('/rh-user-groups-create', requireRhConfigAccess('edit'), wrap(rhUserGroupsCreateHandler));
router.post('/rh-user-groups-update', requireRhConfigAccess('edit'), wrap(rhUserGroupsUpdateHandler));
router.post('/rh-user-groups-delete', requireRhConfigAccess('edit'), wrap(rhUserGroupsDeleteHandler));

export default router;
