import React from 'react'
import './EventsCalendar.css'
import { v4 as uuidv4 } from 'uuid';
import { Calendar, Views, momentLocalizer } from 'react-big-calendar'
import Modal from 'react-modal'
import moment from 'moment'
import 'moment/locale/fr'
import 'react-big-calendar/lib/css/react-big-calendar.css'

import events from '../events'

const navigate = {
    PREVIOUS: 'PREV',
    NEXT: 'NEXT',
    TODAY: 'TODAY',
    DATE: 'DATE',
}

// Setup the localizer by providing the moment (or globalize) Object
// to the correct localizer.
const localizer = momentLocalizer(moment) // or globalizeLocalizer


class CustomToolbar extends React.Component {

    render() {
        let { localizer: { messages }, label } = this.props
        return(
            <div className="rbc-toolbar">
                <span className="rbc-btn-group">
                    <button type="button" onClick={this.navigate.bind(null, navigate.PREVIOUS)}>Précédent</button>
                    <button type="button" onClick={this.navigate.bind(null, navigate.NEXT)}>Suivant</button>
                </span>
                <span className="rbc-toolbar-label">{label}</span>
                <span className="rbc-btn-group">
                    <button type="button" onClick={this.props.openJSONLoadModal}>Charger un fichier de créneaux</button>
                </span>
            </div>
        )
    }
    navigate = action => {
        this.props.onNavigate(action)
    }
}

class EventsCalendar extends React.Component {

    constructor(props) {

        super(props);
        this.JSONEventsFileInput = React.createRef()
        this.state = {
            events: events,
            dayLayoutAlgorithm: 'no-overlap',
            slotLengthCalendar: 30,
            slotLengthChosen: 105,
            beginningOfTheDay: new Date(1970, 1, 1, 8, 0, 0),
            endOfTheDay: new Date(1970, 1, 1, 19, 30, 0),
            showLoadJSONModal: false,
        };
    } 

    handleOpenLoadJSONModal = () => {
        this.setState({showLoadJSONModal: true})
    }

    handleCloseLoadJSONModal = () => {
        this.setState({showLoadJSONModal: false})
    }

    handleSelectSlot = ({ start, end }) => {

        end.setMinutes(end.getMinutes()+(this.state.slotLengthChosen - this.state.slotLengthCalendar))
        // vérifie qu'un créneau n'en chevauche pas un autre
        let isPossible = this.state.events.filter((ev) => (start >= ev.start && start < ev.end) || (end > ev.start && end <= ev.end)).length > 0 ? false : true

        if(start.getHours() >= this.state.beginningOfTheDay.getHours() && end.getHours() <= this.state.endOfTheDay.getHours()) {

            if(isPossible) {

                //const title = window.prompt('Nouveau créneau : ')
                const title = "CyberLab dispo"

                if (title)
                this.setState({
                    events: [
                    ...this.state.events,
                    {
                        id: uuidv4(),
                        start,
                        end,
                        title,
                    },
                    ],
                })
            } else {
                alert("Un autre créneau existe déjà à ce moment.")
            }
            
        } else {
            alert("Restez dans les limites de la journée.")
        }
    }

    handleRemoveEvent = (event) => {
        let c = window.confirm("Supprimer le créneau ?")
        if(c) this.setState({events: this.state.events.filter(e => e.id !== event.id)})
    }

    handleSubmitJSONEventsFile = (evt) => {
        evt.preventDefault()
        alert(`Fichier sélectionné - ${this.JSONEventsFileInput.current.files[0].name}`)
    }
    
    render() {

        return (
            <div className="calendarContainer">
                <Modal 
                    isOpen={this.state.showLoadJSONModal}
                    contentLabel="Load JSON custom events">
                    <button onClick={this.handleCloseLoadJSONModal}>Fermer</button>
                    <p>
                        Charger un fichier de créneaux JSON de la forme où chaque élément contient :<br/>
                        start: objet Date décrivant le début du créneau<br/>
                        end : object Date décrivant la fin du créneau<br/>
                        Les créneaux chevauchant d'autres créneaux ne seront pas pris en compte.<br/>
                    </p>
                    <form onSubmit={this.handleSubmitJSONEventsFile}>
                        <label>Garder les créneaux existants
                            <input type="checkbox" name="keepExistingEvents"/>
                        </label>
                        <br/>
                        <input type="file" accept=".json" ref={this.JSONEventsFileInput} />
                        <br />
                        <button type="submit">Envoyer</button>
                    </form>
                </Modal>
                <Calendar
                    selectable
                    localizer={localizer}
                    events={this.state.events}
                    defaultView={Views.WEEK}
                    views={[Views.WEEK]}
                    scrollToTime={new Date(1970, 1, 1, 6)}
                    defaultDate={new Date()}
                    //onSelectEvent={event => alert(event.title)}
                    onDoubleClickEvent={this.handleRemoveEvent}
                    onSelectSlot={this.handleSelectSlot}
                    dayLayoutAlgorithm={this.state.dayLayoutAlgorithm}
                    step={15}
                    timeslots={4}
                    min={this.state.beginningOfTheDay}
                    max={this.state.endOfTheDay}
                    onSelecting={() => {return false}} // éviter "d'étirer" un évnènement avec la souris
                    slotPropGetter={(date) => {return {className: "my_slot"}}}
                    components={{
                        toolbar: props => ( <CustomToolbar {...props} openJSONLoadModal={this.handleOpenLoadJSONModal}/>)
                    }}

                />
            </div>
        )
    }
  }

export default EventsCalendar;
