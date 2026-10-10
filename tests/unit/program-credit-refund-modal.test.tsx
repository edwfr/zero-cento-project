import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ProgramCreditRefundModal from '@/components/ProgramCreditRefundModal'

const onRefund = vi.fn()
const onKeep = vi.fn()
const onClose = vi.fn()

const renderModal = (isLoading = false) =>
    render(<ProgramCreditRefundModal programTitle="Forza A" isLoading={isLoading} onRefund={onRefund} onKeep={onKeep} onClose={onClose} />)

describe('ProgramCreditRefundModal', () => {
    beforeEach(() => vi.clearAllMocks())

    it('explains that the program consumed a credit', () => {
        renderModal()

        expect(screen.getByRole('dialog')).toHaveTextContent('programs.refund.message')
    })

    it('offers refund, delete without refund and cancel as three separate choices', () => {
        renderModal()

        fireEvent.click(screen.getByRole('button', { name: 'programs.refund.refund' }))
        expect(onRefund).toHaveBeenCalledTimes(1)
        expect(onKeep).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'programs.refund.keep' }))
        expect(onKeep).toHaveBeenCalledTimes(1)

        fireEvent.click(screen.getByRole('button', { name: 'common:common.cancel' }))
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('disables every choice while the deletion is running', () => {
        renderModal(true)

        for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
    })
})
