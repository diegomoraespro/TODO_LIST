package io.github.gerenciador.gerenciadorDeTarefas.repository;

import io.github.gerenciador.gerenciadorDeTarefas.model.Gerenciador;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GerenciadorRepository extends JpaRepository<Gerenciador, Long> {
}

