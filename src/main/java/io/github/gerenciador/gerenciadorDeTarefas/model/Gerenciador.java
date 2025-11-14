package io.github.gerenciador.gerenciadorDeTarefas.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.persistence.*;

import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;


@Entity
@Table(name = "gerenciador")
public class Gerenciador implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name ="Titulo", length = 100)
    private String title;

    @Column(name = "Descricao", columnDefinition = "TEXT")
    private String description;

    @Column(name = "Data")
    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "Prioridade")
    private Priority priority = Priority.MEDIUM;

    @ElementCollection
    @CollectionTable(name = "gerenciador_tags", joinColumns = @JoinColumn(name = "gerenciador_id"))


    private List<String> tags = new ArrayList<>();

    @Column(name = "CONCLUIDAS")
    private boolean completed = false;

    @Column(name = "Data_Criacao")
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm")
    private LocalDateTime createdAt = LocalDateTime.now();

    /**
     * Índice de ordenação (opcional) — pode representar posição na lista.
     */
    @Column(name = "Orden")
    private Integer orderIndex = 0;

    public Gerenciador() {
    }

    public Gerenciador(String title, String description, LocalDate dueDate, Priority priority, List<String> tags) {
        this.title = title;
        this.description = description;
        this.dueDate = dueDate;
        this.priority = priority == null ? Priority.MEDIUM : priority;
        this.tags = tags == null ? new ArrayList<>() : tags;
        this.createdAt = LocalDateTime.now();
    }

    // Conveniência: aceita tags como string separada por vírgula
    public static List<String> parseTags(String commaSeparated) {
        if (commaSeparated == null || commaSeparated.trim().isEmpty()) return new ArrayList<>();
        String[] parts = commaSeparated.split("\\s*,\\s*");
        return new ArrayList<>(Arrays.asList(parts));
    }

    // Getters / Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public Priority getPriority() {
        return priority;
    }

    public void setPriority(Priority priority) {
        this.priority = priority;
    }

    public List<String> getTags() {
        return tags;
    }

    public void setTags(List<String> tags) {
        this.tags = tags;
    }

    public boolean isCompleted() {
        return completed;
    }

    public void setCompleted(boolean completed) {
        this.completed = completed;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public Integer getOrderIndex() {
        return orderIndex;
    }

    public void setOrderIndex(Integer orderIndex) {
        this.orderIndex = orderIndex;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Gerenciador)) return false;
        Gerenciador that = (Gerenciador) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "Gerenciador{" +
                "id=" + id +
                ", title='" + title + '\'' +
                ", description='" + description + '\'' +
                ", dueDate=" + dueDate +
                ", priority=" + priority +
                ", tags=" + tags +
                ", completed=" + completed +
                ", createdAt=" + createdAt +
                ", orderIndex=" + orderIndex +
                '}';
    }

    public enum Priority {
        LOW("low"), MEDIUM("medium"), HIGH("high");

        private final String value;

        Priority(String value) {
            this.value = value;
        }

        public String getValue() {
            return value;
        }

        public static Priority fromString(String v) {
            if (v == null) return MEDIUM;
            switch (v.toLowerCase()) {
                case "low":
                    return LOW;
                case "high":
                    return HIGH;
                default:
                    return MEDIUM;
            }
        }
    }
}
