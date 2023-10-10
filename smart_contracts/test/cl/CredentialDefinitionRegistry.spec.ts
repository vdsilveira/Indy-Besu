import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { DidRegistry } from '../../contracts-ts'
import { Contract } from '../../utils'
import { ClErrors } from '../errors'
import {
  createBaseDidDocument,
  createCredentialDefinitionObject,
  createFakeSignature,
  createSchemaObject,
  TestableCredentialDefinitionRegistry,
  TestableSchemaRegistry,
} from '../utils'

describe('CredentialDefinitionRegistry', function () {
  const issuerId = 'did:indy2:mainnet:SEp33q43PsdP7nDATyySSH'

  async function deployCredDefContractFixture() {
    const didValidator = new Contract('DidValidator')
    await didValidator.deploy()

    const didRegistry = new DidRegistry()
    await didRegistry.deploy({ libraries: [didValidator] })

    const didDocument = createBaseDidDocument(issuerId)
    const signature = createFakeSignature(issuerId)

    await didRegistry.createDid(didDocument, [signature])

    const schemaRegistry = new TestableSchemaRegistry()
    await schemaRegistry.deploy({ params: [didRegistry.address] })

    const schema = createSchemaObject({ issuerId })
    await schemaRegistry.createSchema(schema)

    const credentialDefinitionRegistry = new TestableCredentialDefinitionRegistry()
    await credentialDefinitionRegistry.deploy({ params: [didRegistry.address, schemaRegistry.address] })

    return {
      didRegistry,
      credentialDefinitionRegistry,
      schemaRegistry,
      schemaId: schema.id,
    }
  }

  describe('Add/Resolve Credential Definition', function () {
    it('Should create and resolve Credential Definition', async function () {
      const { credentialDefinitionRegistry, schemaId } = await loadFixture(deployCredDefContractFixture)

      const credDef = createCredentialDefinitionObject({ issuerId, schemaId })

      await credentialDefinitionRegistry.createCredentialDefinition(credDef)
      const result = await credentialDefinitionRegistry.resolveCredentialDefinition(credDef.id)

      expect(result.credDef).to.be.deep.equal(credDef)
    })

    it('Should fail if resolving Credential Definition does not exist', async function () {
      const { credentialDefinitionRegistry, schemaId } = await loadFixture(deployCredDefContractFixture)

      const credDef = createCredentialDefinitionObject({ issuerId, schemaId })

      await expect(credentialDefinitionRegistry.resolveCredentialDefinition(credDef.id))
        .to.be.revertedWithCustomError(credentialDefinitionRegistry.baseInstance, ClErrors.CredentialDefinitionNotFound)
        .withArgs(credDef.id)
    })

    it('Should fail if Credential Definition is being already exists', async function () {
      const { credentialDefinitionRegistry, schemaId } = await loadFixture(deployCredDefContractFixture)

      const credDef = createCredentialDefinitionObject({ issuerId, schemaId })

      await credentialDefinitionRegistry.createCredentialDefinition(credDef)

      await expect(credentialDefinitionRegistry.createCredentialDefinition(credDef))
        .to.be.revertedWithCustomError(
          credentialDefinitionRegistry.baseInstance,
          ClErrors.CredentialDefinitionAlreadyExist,
        )
        .withArgs(credDef.id)
    })

    it('Should fail if Credential Definition is being created with non-existing Issuer', async function () {
      const { credentialDefinitionRegistry, schemaId } = await loadFixture(deployCredDefContractFixture)

      const credDef = createCredentialDefinitionObject({
        issuerId: 'did:indy2:mainnet:GEzcdDLhCpGCYRHW82kjHd',
        schemaId,
      })

      await expect(credentialDefinitionRegistry.createCredentialDefinition(credDef))
        .to.be.revertedWithCustomError(credentialDefinitionRegistry.baseInstance, ClErrors.IssuerNotFound)
        .withArgs(credDef.issuerId)
    })

    it('Should fail if Credential Definition is being created with inactive Issuer', async function () {
      const { didRegistry, credentialDefinitionRegistry, schemaId } = await loadFixture(deployCredDefContractFixture)

      const signature = createFakeSignature(issuerId)
      didRegistry.deactivateDid(issuerId, [signature])

      const credDef = createCredentialDefinitionObject({ issuerId, schemaId })

      await expect(credentialDefinitionRegistry.createCredentialDefinition(credDef))
        .to.be.revertedWithCustomError(credentialDefinitionRegistry.baseInstance, ClErrors.IssuerHasBeenDeactivated)
        .withArgs(credDef.issuerId)
    })

    it('Should fail if Credential Definition is being created with non-existing Schema', async function () {
      const { credentialDefinitionRegistry, schemaRegistry } = await loadFixture(deployCredDefContractFixture)

      const credDef = createCredentialDefinitionObject({
        issuerId,
        schemaId: 'did:indy2:mainnet:SEp33q43PsdP7nDATyySSH/anoncreds/v0/SCHEMA/Test/1.0.0',
      })

      await expect(credentialDefinitionRegistry.createCredentialDefinition(credDef))
        .to.be.revertedWithCustomError(schemaRegistry.baseInstance, ClErrors.SchemaNotFound)
        .withArgs(credDef.schemaId)
    })

    it('Should fail if Credential Definition is being created with unsupported type', async function () {
      const { credentialDefinitionRegistry, schemaId } = await loadFixture(deployCredDefContractFixture)

      const credDef = createCredentialDefinitionObject({ issuerId, schemaId, credDefType: 'CL2' })

      await expect(credentialDefinitionRegistry.createCredentialDefinition(credDef))
        .to.be.revertedWithCustomError(
          credentialDefinitionRegistry.baseInstance,
          ClErrors.UnsupportedCredentialDefintionType,
        )
        .withArgs(credDef.credDefType)
    })

    it('Should fail if Credential Definition is being created with empty tag', async function () {
      const { credentialDefinitionRegistry, schemaId } = await loadFixture(deployCredDefContractFixture)

      const credDef = createCredentialDefinitionObject({ issuerId, schemaId, tag: '' })

      await expect(credentialDefinitionRegistry.createCredentialDefinition(credDef))
        .to.be.revertedWithCustomError(credentialDefinitionRegistry.baseInstance, ClErrors.FieldRequired)
        .withArgs('tag')
    })

    it('Should fail if Credential Definition is being created with empty value', async function () {
      const { credentialDefinitionRegistry, schemaId } = await loadFixture(deployCredDefContractFixture)

      const credDef = createCredentialDefinitionObject({ issuerId, schemaId, value: '' })

      await expect(credentialDefinitionRegistry.createCredentialDefinition(credDef))
        .to.be.revertedWithCustomError(credentialDefinitionRegistry.baseInstance, ClErrors.FieldRequired)
        .withArgs('value')
    })

    it('Should fail if Credential Definition is being with invalid ID', async function () {
      const { credentialDefinitionRegistry, schemaId } = await loadFixture(deployCredDefContractFixture)

      const credDef = createCredentialDefinitionObject({ issuerId, schemaId })
      credDef.id = 'Gs6cQcvrtWoZKsbBhD3dQJ:3:CL:140384:mctc'

      await expect(credentialDefinitionRegistry.createCredentialDefinition(credDef))
        .to.be.revertedWithCustomError(
          credentialDefinitionRegistry.baseInstance,
          ClErrors.InvalidCredentialDefinitionId,
        )
        .withArgs(credDef.id)
    })
  })
})